import "server-only";
import type { Prisma } from "@/backend/generated/prisma/client";
import { AuditWriter } from "@/backend/admin/audit/audit-writer";
import { PrivilegedRationaleService } from "@/backend/admin/rationales/privileged-rationale-service";
import { PrismaSecurityNotificationRepository } from "@/backend/repositories/admin/prisma-security-notification-repository";

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
      | "admin.session_revoked"
      | "admin.sessions_revoked_all";
    reasonCategory: string;
    explanation: string;
    priorState: string;
    resultingState: string;
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
  if (input.notify)
    await new PrismaSecurityNotificationRepository(tx).enqueue({
      idempotencyKey: `security:${input.correlationId}`,
      originatingCorrelationId: input.correlationId,
      targetUserId: input.targetUserId,
      kind: input.action,
      payloadRef: {
        resultingState: input.resultingState,
        occurredAt: input.occurredAt.toISOString(),
      },
      status: "PENDING",
      attemptCount: 0,
      nextAttemptAt: input.occurredAt,
      deliveryDeadline: new Date(input.occurredAt.getTime() + 24 * 60 * 60_000),
    });
}
