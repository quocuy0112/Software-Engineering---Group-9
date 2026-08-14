import "server-only";
import type { Prisma } from "@/backend/generated/prisma/client";
import type { PrismaClient } from "@/backend/generated/prisma/client";
import { createInAppNotification } from "@/backend/notifications/notification-service";
import {
  emailDeliveryIdempotencyKey,
  verificationBusinessEventKey,
  type CompanyMembershipRole,
  type VerificationEventKind,
} from "./notification-events";

const databaseKind = {
  VERIFICATION_APPROVED: "VERIFICATION_APPROVED",
  VERIFICATION_RECEIPT: "VERIFICATION_RECEIVED",
  VERIFICATION_CHANGES_REQUESTED: "VERIFICATION_CHANGES_REQUESTED",
  VERIFICATION_REJECTED: "VERIFICATION_REJECTED",
  VERIFICATION_CANCELLED: "VERIFICATION_CANCELLED",
  VERIFICATION_DELAYED: "VERIFICATION_DELAYED",
  VERIFICATION_EXPIRED: "VERIFICATION_EXPIRED",
} as const;

export type VerificationNotificationInput = {
  requestId: string;
  userId: string;
  eventKind: VerificationEventKind;
  resultingState: string;
  resultingVersion: number;
  occurredAt: Date;
  nextAction: string;
  companyDisplayName?: string;
  approvedMembershipRole?: CompanyMembershipRole;
  rejectionCategory?: string;
  applicantComment?: string;
};

export function buildVerificationOutbox(
  input: VerificationNotificationInput,
): Prisma.EmailOutboxUncheckedCreateInput {
  const businessEventKey = verificationBusinessEventKey(
    input.requestId,
    input.eventKind,
    input.resultingVersion,
  );
  return {
    kind: databaseKind[input.eventKind],
    userId: input.userId,
    verificationRequestId: input.requestId,
    recipientRef: input.userId,
    templateVersion: "verification-v1",
    payloadRef: {
      eventKind: input.eventKind,
      requestId: input.requestId,
      resultingState: input.resultingState,
      occurredAt: input.occurredAt.toISOString(),
      nextAction: input.nextAction,
      ...(input.companyDisplayName
        ? { companyDisplayName: input.companyDisplayName }
        : {}),
      ...(input.approvedMembershipRole
        ? { approvedMembershipRole: input.approvedMembershipRole }
        : {}),
      ...(input.rejectionCategory
        ? { rejectionCategory: input.rejectionCategory }
        : {}),
      ...(input.applicantComment
        ? { applicantComment: input.applicantComment }
        : {}),
    },
    idempotencyKey: emailDeliveryIdempotencyKey(businessEventKey),
    status: "PENDING",
    nextAttemptAt: input.occurredAt,
  };
}

export function createVerificationInAppNotification(
  db: PrismaClient | Prisma.TransactionClient,
  input: VerificationNotificationInput,
  correlationId: string,
) {
  const businessEventKey = verificationBusinessEventKey(
    input.requestId,
    input.eventKind,
    input.resultingVersion,
  );
  return createInAppNotification(db, {
    recipientUserId: input.userId,
    kind:
      input.eventKind === "VERIFICATION_RECEIPT"
        ? "VERIFICATION_RECEIVED"
        : input.eventKind,
    deduplicationKey: businessEventKey,
    correlationId,
    occurredAt: input.occurredAt,
    contextType: "VERIFICATION_REQUEST",
    contextId: input.requestId,
    variables: {
      state: input.resultingState,
      ...(input.companyDisplayName
        ? { companyName: input.companyDisplayName }
        : {}),
    },
  });
}

/**
 * The applicant owns the normal verification receipt. Administrators also
 * need a recipient-owned inbox item so the Admin bell reflects newly submitted
 * recruiter requests. Fan-out is limited to currently active administrator
 * grants and each recipient receives a deterministic, English notification.
 */
export async function notifyActiveAdministratorsOfVerificationSubmission(
  db: PrismaClient | Prisma.TransactionClient,
  input: {
    requestId: string;
    submissionVersion: number;
    occurredAt: Date;
    correlationId: string;
  },
) {
  const administrators = await db.platformAdministratorGrant.findMany({
    where: {
      state: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: input.occurredAt } }],
      user: { state: "ACTIVE", deletedAt: null },
    },
    select: { userId: true },
  });
  const businessEventKey = verificationBusinessEventKey(
    input.requestId,
    "VERIFICATION_RECEIPT",
    input.submissionVersion,
  );
  for (const administrator of administrators) {
    await createInAppNotification(db, {
      recipientUserId: administrator.userId,
      kind: "VERIFICATION_RECEIVED",
      deduplicationKey: `admin-verification:${businessEventKey}:${administrator.userId}`,
      correlationId: input.correlationId,
      occurredAt: input.occurredAt,
      contextType: "VERIFICATION_REQUEST",
      contextId: input.requestId,
      variables: { audience: "ADMIN" },
      language: "EN",
    });
  }
}
