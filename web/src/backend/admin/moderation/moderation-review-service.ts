import "server-only";
import type { AdminAuthority } from "@/backend/security/admin-request-boundary";
import {
  PrismaAdminCommandRepository,
  AdminCommandConflict,
} from "@/backend/repositories/admin/prisma-admin-command-repository";
import { AuditWriter } from "@/backend/admin/audit/audit-writer";
import { normalizeAdminPlainText } from "@/shared/contracts/admin/common";
import { PrismaModerationRepository } from "@/backend/repositories/admin/prisma-moderation-repository";
import { createInAppNotification } from "@/backend/notifications/notification-service";
type Command = {
  expectedVersion: number;
  idempotencyKey: string;
  note?: string;
  enforcementCorrelationId?: string;
};
export class ModerationReviewService {
  list(input: {
    page: number;
    perPage: number;
    filter: Record<string, unknown>;
  }) {
    return new PrismaModerationRepository().list(input);
  }
  detail(reportId: string) {
    return new PrismaModerationRepository().detail(reportId);
  }
  execute(
    authority: AdminAuthority,
    reportId: string,
    action: "assign" | "note" | "resolve" | "dismiss" | "link-enforcement",
    command: Command,
  ) {
    const now = new Date();
    return new PrismaAdminCommandRepository().execute(
      {
        actorUserId: authority.userId,
        actorSessionId: authority.sessionId,
        grantId: authority.grantId,
        commandKind: `moderation.${action}`,
        targetReference: reportId,
        idempotencyKey: command.idempotencyKey,
        normalizedBody: command,
      },
      async (tx, correlationId) => {
        const row = await tx.moderationReport.findUnique({
          where: { id: reportId },
        });
        if (!row) throw new Error("TARGET_UNAVAILABLE");
        if (row.version !== command.expectedVersion)
          throw new AdminCommandConflict("STALE_CONFLICT", row.version);
        if (
          ["resolve", "dismiss", "assign", "note"].includes(action) &&
          row.state !== "PENDING_REVIEW"
        )
          throw new Error("INVALID_STATE");
        const state =
          action === "resolve"
            ? "RESOLVED"
            : action === "dismiss"
              ? "DISMISSED"
              : row.state;
        const version = row.version + 1;
        let note: string | undefined;
        if (action === "note") {
          note = normalizeAdminPlainText(command.note ?? "");
          if (!note || Array.from(note).length > 2000)
            throw new Error("VALIDATION_FAILED");
        }
        const claimed = await tx.moderationReport.updateMany({
          where: {
            id: row.id,
            version: command.expectedVersion,
            state: row.state,
          },
          data: {
            version,
            state,
            assignedAdminUserId:
              action === "assign" ? authority.userId : row.assignedAdminUserId,
            terminalAt: state === "PENDING_REVIEW" ? null : now,
            unresolvedKey:
              state === "PENDING_REVIEW" ? row.unresolvedKey : null,
          },
        });
        if (claimed.count !== 1)
          throw new AdminCommandConflict("STALE_CONFLICT", version);
        if (note)
          await tx.moderationPrivateNote.create({
            data: {
              reportId: row.id,
              authorAdminUserId: authority.userId,
              normalizedText: note,
            },
          });
        const actionName = (
          {
            assign: "admin.report_assigned",
            note: "admin.report_noted",
            resolve: "admin.report_resolved",
            dismiss: "admin.report_dismissed",
            "link-enforcement": "admin.report_enforcement_linked",
          } as const
        )[action];
        await tx.moderationReportHistory.create({
          data: {
            reportId: row.id,
            actorAdminUserId: authority.userId,
            action,
            priorState: row.state,
            resultingState: state,
            resultingVersion: version,
            enforcementCorrelationId:
              action === "link-enforcement"
                ? command.enforcementCorrelationId
                : null,
            occurredAt: now,
          },
        });
        if (action === "resolve" || action === "dismiss") {
          await createInAppNotification(tx, {
            recipientUserId: row.reporterUserId,
            kind:
              action === "resolve"
                ? "MODERATION_REPORT_RESOLVED"
                : "MODERATION_REPORT_DISMISSED",
            deduplicationKey: `moderation-report:${row.id}:${state.toLowerCase()}:v${version}`,
            correlationId,
            occurredAt: now,
            contextType: "MODERATION_REPORT",
            contextId: row.id,
          });
        }
        await new AuditWriter(tx).append({
          occurredAt: now,
          actorType: "user",
          actorUserId: authority.userId,
          actorSessionId: authority.sessionId,
          action: actionName,
          targetType: "moderation_report",
          targetId: row.id,
          result: "SUCCESS",
          correlationId,
          context: {
            priorState: row.state,
            resultingState: state,
            targetVersion: version,
            companyReference: row.companyReference ?? undefined,
          },
        });
        return {
          version,
          state,
          assignedAdministratorId:
            action === "assign" ? authority.userId : row.assignedAdminUserId,
        };
      },
    );
  }
}
