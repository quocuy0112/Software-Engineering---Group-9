import "server-only";
import type { Prisma } from "@/backend/generated/prisma/client";

const permanentFailureCategories = new Set([
  "DESTINATION_REJECTED",
  "DESTINATION_DISABLED",
  "CONTENT_INVALID",
  "POLICY_REFUSED",
]);

export async function reconcileSecurityNotificationForOutbox(
  tx: Prisma.TransactionClient,
  emailOutboxId: string,
) {
  const outbox = await tx.emailOutbox.findUnique({
    where: { id: emailOutboxId },
    select: {
      id: true,
      status: true,
      attempts: true,
      nextAttemptAt: true,
      safeErrorCode: true,
      updatedAt: true,
    },
  });
  if (!outbox) return { count: 0, status: null };

  const status =
    outbox.status === "SENT"
      ? "DELIVERED"
      : outbox.status === "DEAD"
        ? "MANUAL_INTERVENTION_REQUIRED"
        : outbox.status === "RETRYABLE" ||
            (outbox.status === "PROCESSING" && outbox.attempts > 0)
          ? "RETRYING"
          : "PENDING";
  const failureCategory =
    outbox.status === "DEAD"
      ? permanentFailureCategories.has(outbox.safeErrorCode ?? "")
        ? (outbox.safeErrorCode as
            | "DESTINATION_REJECTED"
            | "DESTINATION_DISABLED"
            | "CONTENT_INVALID"
            | "POLICY_REFUSED")
        : "ATTEMPTS_EXHAUSTED"
      : status === "RETRYING"
        ? "TEMPORARY_UNAVAILABLE"
        : null;

  const changed = await tx.securityNotificationWork.updateMany({
    where: { emailOutboxId },
    data: {
      status,
      attemptCount: outbox.attempts,
      lastAttemptAt: outbox.attempts > 0 ? outbox.updatedAt : null,
      nextAttemptAt:
        outbox.status === "PENDING" ||
        outbox.status === "PROCESSING" ||
        outbox.status === "RETRYABLE"
          ? outbox.nextAttemptAt
          : null,
      failureCategory,
      leaseOwner: null,
      leaseExpiresAt: null,
    },
  });
  return { count: changed.count, status };
}
