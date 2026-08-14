import "server-only";
import type { AdminAuthority } from "@/backend/security/admin-request-boundary";
import {
  AdminCommandConflict,
  PrismaAdminCommandRepository,
} from "@/backend/repositories/admin/prisma-admin-command-repository";
import { PrismaAdminMessagingReportRepository } from "@/backend/repositories/admin/prisma-admin-messaging-report-repository";
import { AuditWriter } from "@/backend/admin/audit/audit-writer";
import { normalizeAdminPlainText } from "@/shared/contracts/admin/common";
import { createInAppNotification } from "@/backend/notifications/notification-service";

export type AdminMessagingReportAction =
  | "assign"
  | "note"
  | "resolve"
  | "dismiss"
  | "link-enforcement";

type Command = {
  expectedVersion: number;
  idempotencyKey: string;
  note?: string;
  enforcementCorrelationId?: string;
};

const pendingOnly = new Set<AdminMessagingReportAction>([
  "assign",
  "note",
  "resolve",
  "dismiss",
]);

export class AdminMessagingReportReviewService {
  list(input: {
    page: number;
    perPage: number;
    filter: Record<string, unknown>;
  }) {
    return new PrismaAdminMessagingReportRepository().list(input);
  }

  detail(reportId: string) {
    return new PrismaAdminMessagingReportRepository().detail(reportId);
  }

  execute(
    authority: AdminAuthority,
    reportId: string,
    action: AdminMessagingReportAction,
    command: Command,
  ) {
    const now = new Date();
    return new PrismaAdminCommandRepository().execute(
      {
        actorUserId: authority.userId,
        actorSessionId: authority.sessionId,
        grantId: authority.grantId,
        commandKind: `messaging-report.${action}`,
        targetReference: reportId,
        idempotencyKey: command.idempotencyKey,
        normalizedBody: command,
      },
      async (tx, correlationId) => {
        const row = await tx.messagingReport.findUnique({
          where: { id: reportId },
        });
        if (!row) throw new Error("TARGET_UNAVAILABLE");
        if (row.version !== command.expectedVersion) {
          throw new AdminCommandConflict("STALE_CONFLICT", row.version);
        }
        if (pendingOnly.has(action) && row.state !== "PENDING_REVIEW") {
          throw new Error("INVALID_STATE");
        }

        let normalizedNote: string | undefined;
        if (action === "note") {
          normalizedNote = normalizeAdminPlainText(command.note ?? "");
          if (!normalizedNote || Array.from(normalizedNote).length > 2000) {
            throw new Error("VALIDATION_FAILED");
          }
        }
        const enforcementCorrelationId =
          action === "link-enforcement"
            ? command.enforcementCorrelationId?.trim()
            : row.enforcementCorrelationId;
        if (
          action === "link-enforcement" &&
          (!enforcementCorrelationId ||
            enforcementCorrelationId.length < 8 ||
            enforcementCorrelationId.length > 128)
        ) {
          throw new Error("VALIDATION_FAILED");
        }

        const state =
          action === "resolve"
            ? "RESOLVED"
            : action === "dismiss"
              ? "DISMISSED"
              : row.state;
        const terminal = state !== "PENDING_REVIEW";
        const version = row.version + 1;
        const assignedAdminUserId =
          action === "assign" ? authority.userId : row.assignedAdminUserId;
        const handledAt = terminal ? (row.handledAt ?? now) : null;
        const handledByAdminUserId = terminal
          ? (row.handledByAdminUserId ?? authority.userId)
          : null;
        const claimed = await tx.messagingReport.updateMany({
          where: {
            id: row.id,
            version: command.expectedVersion,
            state: row.state,
          },
          data: {
            version,
            state,
            assignedAdminUserId,
            handledAt,
            handledByAdminUserId,
            enforcementCorrelationId,
            unresolvedKey: terminal ? null : row.unresolvedKey,
          },
        });
        if (claimed.count !== 1) {
          throw new AdminCommandConflict("STALE_CONFLICT", row.version);
        }
        if (normalizedNote) {
          await tx.messagingReportPrivateNote.create({
            data: {
              reportId: row.id,
              authorAdminUserId: authority.userId,
              normalizedText: normalizedNote,
              createdAt: now,
            },
          });
        }
        await tx.messagingReportReviewEvent.create({
          data: {
            reportId: row.id,
            actorAdminUserId: authority.userId,
            action,
            priorState: row.state,
            resultingState: state,
            resultingVersion: version,
            enforcementCorrelationId:
              action === "link-enforcement" ? enforcementCorrelationId : null,
            occurredAt: now,
          },
        });
        if (action === "resolve" || action === "dismiss") {
          await createInAppNotification(tx, {
            recipientUserId: row.reporterUserId,
            kind:
              action === "resolve"
                ? "MESSAGE_REPORT_RESOLVED"
                : "MESSAGE_REPORT_DISMISSED",
            deduplicationKey: `messaging-report:${row.id}:${state.toLowerCase()}:v${version}`,
            correlationId,
            occurredAt: now,
            contextType: "MESSAGING_REPORT",
            contextId: row.id,
          });
        }
        const auditAction = (
          {
            assign: "admin.report_assigned",
            note: "admin.report_noted",
            resolve: "admin.report_resolved",
            dismiss: "admin.report_dismissed",
            "link-enforcement": "admin.report_enforcement_linked",
          } as const
        )[action];
        await new AuditWriter(tx).append({
          occurredAt: now,
          actorType: "user",
          actorUserId: authority.userId,
          actorSessionId: authority.sessionId,
          action: auditAction,
          targetType: "messaging_report",
          targetId: row.id,
          result: "SUCCESS",
          correlationId,
          context: {
            priorState: row.state,
            resultingState: state,
            targetVersion: version,
          },
        });
        return {
          version,
          state,
          assignedAdministratorId: assignedAdminUserId,
          handledAt: handledAt?.toISOString() ?? null,
          handledByAdministratorId: handledByAdminUserId,
          enforcementCorrelationId: enforcementCorrelationId ?? null,
        };
      },
    );
  }
}
