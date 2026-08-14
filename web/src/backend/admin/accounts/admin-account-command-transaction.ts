import "server-only";
import type { Prisma } from "@/backend/generated/prisma/client";
import { AuditWriter } from "@/backend/admin/audit/audit-writer";
import { PrivilegedRationaleService } from "@/backend/admin/rationales/privileged-rationale-service";
import { PrismaSecurityNotificationRepository } from "@/backend/repositories/admin/prisma-security-notification-repository";
import {
  accountBusinessEventKey,
  securityNotificationIdempotencyKey,
  type AdminSecurityEventKind,
} from "@/backend/admin/notifications/notification-events";
import { createInAppNotification } from "@/backend/notifications/notification-service";

export async function recordAccountCommand(
  tx: Prisma.TransactionClient,
  input: {
    correlationId: string;
    actorUserId: string;
    actorSessionId: string;
    targetUserId: string;
    action:
      | "admin.account_suspended"
      | "admin.account_reinstated"
      | "admin.account_restored"
      | "admin.session_revoked"
      | "admin.sessions_revoked_all";
    reasonCategory: string;
    explanation: string;
    priorState: string;
    resultingState: string;
    resultingVersion: number;
    occurredAt: Date;
    notify: boolean;
  },
) {
  await new AuditWriter(tx).append({
    occurredAt: input.occurredAt,
    actorType: "user",
    actorUserId: input.actorUserId,
    actorSessionId: input.actorSessionId,
    action: input.action,
    targetType: "user_account",
    targetId: input.targetUserId,
    result: "SUCCESS",
    correlationId: input.correlationId,
    context: {
      reasonCategory: input.reasonCategory,
      priorState: input.priorState,
      resultingState: input.resultingState,
    },
  });
  await new PrivilegedRationaleService().create(tx, {
    correlationId: input.correlationId,
    explanation: input.explanation,
    actionAt: input.occurredAt,
  });
  if (input.notify) {
    const eventKind: Extract<
      AdminSecurityEventKind,
      | "ACCOUNT_SUSPENDED"
      | "ACCOUNT_REINSTATED"
      | "ACCOUNT_RESTORED"
      | "ALL_SESSIONS_REVOKED"
    > =
      input.action === "admin.account_suspended"
        ? "ACCOUNT_SUSPENDED"
        : input.action === "admin.account_reinstated"
          ? "ACCOUNT_REINSTATED"
          : input.action === "admin.account_restored"
            ? "ACCOUNT_RESTORED"
            : "ALL_SESSIONS_REVOKED";
    const businessEventKey = accountBusinessEventKey(
      input.targetUserId,
      eventKind,
      input.resultingVersion,
    );
    // The immutable audit action distinguishes ACCOUNT_RESTORED from the
    // legacy ACCOUNT_REINSTATED label, while the unified notification enum
    // intentionally keeps one user-facing restoration kind.
    const inAppKind =
      eventKind === "ACCOUNT_RESTORED" ? "ACCOUNT_REINSTATED" : eventKind;
    await new PrismaSecurityNotificationRepository(tx).enqueue({
      idempotencyKey: securityNotificationIdempotencyKey(businessEventKey),
      originatingCorrelationId: input.correlationId,
      targetUserId: input.targetUserId,
      kind: eventKind,
      payloadRef: {
        resultingState: input.resultingState,
        occurredAt: input.occurredAt.toISOString(),
        reasonCategory: input.reasonCategory,
        supportPath: "/support/account-security",
      },
      status: "PENDING",
      attemptCount: 0,
      nextAttemptAt: input.occurredAt,
      deliveryDeadline: new Date(input.occurredAt.getTime() + 24 * 60 * 60_000),
    });
    await createInAppNotification(tx, {
      recipientUserId: input.targetUserId,
      kind: inAppKind,
      deduplicationKey: securityNotificationIdempotencyKey(businessEventKey),
      correlationId: input.correlationId,
      occurredAt: input.occurredAt,
      contextType: "ACCOUNT",
      contextId: input.targetUserId,
      variables: { state: input.resultingState },
    });
  }
}
