import "server-only";
import type { AdminAuthority } from "@/backend/security/admin-request-boundary";
import {
  PrismaAdminCommandRepository,
  AdminCommandConflict,
} from "@/backend/repositories/admin/prisma-admin-command-repository";
import { AuditWriter } from "@/backend/admin/audit/audit-writer";
import { PrismaVerificationRepository } from "@/backend/repositories/admin/prisma-verification-repository";
import {
  buildVerificationOutbox,
  createVerificationInAppNotification,
} from "@/backend/admin/notifications/verification-outbox";
type Base = {
  expectedVersion: number;
  idempotencyKey: string;
  privateNote?: string;
};
export class VerificationReviewService {
  list(input: {
    page: number;
    perPage: number;
    filter: Record<string, unknown>;
    adminUserId: string;
  }) {
    return new PrismaVerificationRepository().list(input);
  }
  detail(requestId: string) {
    return new PrismaVerificationRepository().detail(requestId);
  }
  private run(
    authority: AdminAuthority,
    requestId: string,
    action: "changes" | "reject",
    command: Base & { guidance?: string; reason?: string; category?: string },
  ) {
    const now = new Date();
    return new PrismaAdminCommandRepository().execute(
      {
        actorUserId: authority.userId,
        actorSessionId: authority.sessionId,
        grantId: authority.grantId,
        commandKind: `verification.${action}`,
        targetReference: requestId,
        idempotencyKey: command.idempotencyKey,
        normalizedBody: command,
      },
      async (tx, correlationId) => {
        const row = await tx.recruiterVerificationRequest.findUnique({
          where: { id: requestId },
        });
        if (!row) throw new Error("TARGET_UNAVAILABLE");
        if (row.version !== command.expectedVersion)
          throw new AdminCommandConflict("STALE_CONFLICT", row.version);
        if (row.state !== "PENDING_REVIEW") throw new Error("INVALID_STATE");
        if (action === "changes" && row.resubmissionCount >= 3)
          throw new Error("RESUBMISSION_LIMIT");
        const resultingState =
          action === "changes" ? "CHANGES_REQUESTED" : "REJECTED";
        const version = row.version + 1;
        const claimed = await tx.recruiterVerificationRequest.updateMany({
          where: {
            id: row.id,
            version: command.expectedVersion,
            state: "PENDING_REVIEW",
          },
          data: {
            state: resultingState,
            changesRequestedAt: action === "changes" ? now : null,
            decidedAt: action === "reject" ? now : null,
            version,
          },
        });
        if (claimed.count !== 1)
          throw new AdminCommandConflict("STALE_CONFLICT", version);
        if (action === "reject")
          await tx.businessLicenseEvidence.updateMany({
            where: { requestId: row.id, contentInaccessibleAt: null },
            data: {
              contentInaccessibleAt: now,
              deleteAfter: new Date(now.getTime() + 24 * 60 * 60_000),
            },
          });
        await tx.verificationDecisionHistory.create({
          data: {
            requestId: row.id,
            submissionVersion: row.currentSubmissionVersion,
            actorAdminUserId: authority.userId,
            priorState: row.state,
            resultingState,
            decisionKind: action === "changes" ? "REQUEST_CHANGES" : "REJECT",
            rejectionCategory: command.category,
            result: "SUCCESS",
            correlationId,
            decidedAt: now,
          },
        });
        if (command.privateNote)
          await tx.verificationPrivateNote.create({
            data: {
              requestId: row.id,
              authorAdminUserId: authority.userId,
              normalizedText: command.privateNote,
            },
          });
        await new AuditWriter(tx).append({
          occurredAt: now,
          actorType: "user",
          actorUserId: authority.userId,
          actorSessionId: authority.sessionId,
          action:
            action === "changes"
              ? "admin.verification_changes_requested"
              : "admin.verification_rejected",
          targetType: "recruiter_verification",
          targetId: row.id,
          result: "SUCCESS",
          correlationId,
          context: {
            priorState: row.state,
            resultingState,
            targetVersion: version,
          },
        });
        const notification = {
            requestId: row.id,
            userId: row.applicantUserId,
            eventKind:
              action === "changes"
                ? "VERIFICATION_CHANGES_REQUESTED"
                : "VERIFICATION_REJECTED",
            resultingState,
            resultingVersion: version,
            occurredAt: now,
            nextAction:
              action === "changes"
                ? "RESUBMIT_OR_CANCEL"
                : "SUBMIT_NEW_REQUEST",
          } as const;
        await tx.emailOutbox.create({
          data: buildVerificationOutbox(notification),
        });
        await createVerificationInAppNotification(
          tx,
          notification,
          correlationId,
        );
        return { version, state: resultingState };
      },
    );
  }
  requestChanges(
    a: AdminAuthority,
    id: string,
    c: Base & { guidance: string },
  ) {
    return this.run(a, id, "changes", c);
  }
  reject(
    a: AdminAuthority,
    id: string,
    c: Base & { category: string; reason: string },
  ) {
    return this.run(a, id, "reject", c);
  }
}
