import "server-only";
import type { Prisma } from "@/backend/generated/prisma/client";
import { AuditWriter } from "@/backend/admin/audit/audit-writer";
import { PrivilegedRationaleService } from "@/backend/admin/rationales/privileged-rationale-service";
import { PrismaSecurityNotificationRepository } from "@/backend/repositories/admin/prisma-security-notification-repository";
import {
  membershipBusinessEventKey,
  securityNotificationIdempotencyKey,
  type AdminSecurityEventKind,
} from "@/backend/admin/notifications/notification-events";
import { createInAppNotification } from "@/backend/notifications/notification-service";
export async function recordMembershipCommand(
  tx: Prisma.TransactionClient,
  input: {
    correlationId: string;
    actorUserId: string;
    actorSessionId: string;
    targetUserId: string;
    membershipId: string;
    companyId: string;
    companyDisplayName: string;
    action:
      | "admin.membership_suspended"
      | "admin.membership_restored"
      | "admin.membership_removed";
    reasonCategory: string;
    explanation: string;
    priorState: "ACTIVE" | "SUSPENDED" | "REMOVED";
    resultingState: "ACTIVE" | "SUSPENDED" | "REMOVED";
    priorRole: "OWNER" | "HR_MANAGER" | "RECRUITER" | "HIRING_MANAGER";
    resultingRole: "OWNER" | "HR_MANAGER" | "RECRUITER" | "HIRING_MANAGER";
    version: number;
    occurredAt: Date;
  },
) {
  await new AuditWriter(tx).append({
    occurredAt: input.occurredAt,
    actorType: "user",
    actorUserId: input.actorUserId,
    actorSessionId: input.actorSessionId,
    action: input.action,
    targetType: "company_membership",
    targetId: input.membershipId,
    result: "SUCCESS",
    correlationId: input.correlationId,
    context: {
      reasonCategory: input.reasonCategory,
      priorState: input.priorState,
      resultingState: input.resultingState,
      targetVersion: input.version,
      companyReference: input.companyId,
    },
  });
  await new PrivilegedRationaleService().create(tx, {
    correlationId: input.correlationId,
    explanation: input.explanation,
    actionAt: input.occurredAt,
  });
  await tx.companyMembershipHistory.create({
    data: {
      membershipId: input.membershipId,
      actorUserId: input.actorUserId,
      priorStatus: input.priorState,
      resultingStatus: input.resultingState,
      priorRole: input.priorRole,
      resultingRole: input.resultingRole,
      version: input.version,
      correlationId: input.correlationId,
      occurredAt: input.occurredAt,
    },
  });
  const eventKind: Extract<
    AdminSecurityEventKind,
    "MEMBERSHIP_SUSPENDED" | "MEMBERSHIP_RESTORED" | "MEMBERSHIP_REMOVED"
  > =
    input.action === "admin.membership_suspended"
      ? "MEMBERSHIP_SUSPENDED"
      : input.action === "admin.membership_restored"
        ? "MEMBERSHIP_RESTORED"
        : "MEMBERSHIP_REMOVED";
  const idempotencyKey = securityNotificationIdempotencyKey(
    membershipBusinessEventKey(input.membershipId, eventKind, input.version),
  );
  await new PrismaSecurityNotificationRepository(tx).enqueue({
    idempotencyKey,
    originatingCorrelationId: input.correlationId,
    targetUserId: input.targetUserId,
    kind: eventKind,
    payloadRef: {
      companyDisplayName: input.companyDisplayName,
      resultingState: input.resultingState,
      occurredAt: input.occurredAt.toISOString(),
    },
    status: "PENDING",
    attemptCount: 0,
    nextAttemptAt: input.occurredAt,
    deliveryDeadline: new Date(input.occurredAt.getTime() + 24 * 60 * 60_000),
  });
  await createInAppNotification(tx, {
    recipientUserId: input.targetUserId,
    kind: eventKind,
    deduplicationKey: idempotencyKey,
    correlationId: input.correlationId,
    occurredAt: input.occurredAt,
    contextType: "MEMBERSHIP",
    contextId: input.membershipId,
    variables: {
      companyName: input.companyDisplayName,
      state: input.resultingState,
    },
  });
}
