import "server-only";
import type { AdminAuthority } from "@/backend/security/admin-request-boundary";
import { AuditWriter } from "@/backend/admin/audit/audit-writer";
import { PrismaAdminCommandRepository } from "@/backend/repositories/admin/prisma-admin-command-repository";
import { PrismaSupportRepository } from "@/backend/repositories/support/prisma-support-repository";
import type { SupportChange } from "@/shared/contracts/support";
import { supportRealtimePublisher } from "../realtime/support-realtime-hub";
import { admitSupportRequest } from "./support-rate-limit";

type Command = {
  expectedVersion: number;
  idempotencyKey: string;
  action: "claim" | "reassign" | "reply" | "note" | "resolve" | "close";
  body: Record<string, unknown>;
};

const auditAction = {
  claim: "admin.support_claimed",
  reassign: "admin.support_reassigned",
  reply: "admin.support_replied",
  note: "admin.support_noted",
  resolve: "admin.support_resolved",
  close: "admin.support_closed",
} as const;

export class AdminSupportService {
  constructor(private readonly repository = new PrismaSupportRepository()) {}

  list(input: {
    page: number;
    perPage: number;
    filter: Record<string, unknown>;
  }) {
    return this.repository.listAdmin(input);
  }

  detail(caseId: string) {
    return this.repository.detailAdmin(caseId);
  }

  async execute(authority: AdminAuthority, caseId: string, command: Command) {
    if (command.action === "reply") {
      await admitSupportRequest("supportSend", authority.userId);
    }
    const result = await new PrismaAdminCommandRepository().execute(
      {
        actorUserId: authority.userId,
        actorSessionId: authority.sessionId,
        grantId: authority.grantId,
        commandKind: `support.${command.action}`,
        targetReference: caseId,
        idempotencyKey: command.idempotencyKey,
        normalizedBody: {
          expectedVersion: command.expectedVersion,
          ...command.body,
        },
      },
      async (tx, correlationId) => {
        const repository = new PrismaSupportRepository(tx);
        const now = new Date();
        const outcome =
          command.action === "claim"
            ? await repository.claim({
                caseId,
                adminUserId: authority.userId,
                expectedVersion: command.expectedVersion,
                now,
              })
            : command.action === "reassign"
              ? await repository.reassign({
                  caseId,
                  adminUserId: authority.userId,
                  assigneeAdminUserId: String(command.body.assigneeAdminUserId),
                  reason: command.body.reason as
                    | "STAFF_HANDOFF"
                    | "WORKLOAD_BALANCE"
                    | "EXPERTISE_REQUIRED",
                  expectedVersion: command.expectedVersion,
                  now,
                })
              : command.action === "reply"
                ? await repository.reply({
                    caseId,
                    adminUserId: authority.userId,
                    content: String(command.body.content),
                    clientOperationId: String(command.body.clientOperationId),
                    expectedVersion: command.expectedVersion,
                    now,
                  })
                : command.action === "note"
                  ? await repository.note({
                      caseId,
                      adminUserId: authority.userId,
                      note: String(command.body.note),
                      expectedVersion: command.expectedVersion,
                      now,
                    })
                  : await repository.transition({
                      caseId,
                      adminUserId: authority.userId,
                      action: command.action,
                      expectedVersion: command.expectedVersion,
                      now,
                    });
        const invalidation = outcome.invalidation;
        await new AuditWriter(tx).append({
          occurredAt: now,
          actorType: "user",
          actorUserId: authority.userId,
          actorSessionId: authority.sessionId,
          action: auditAction[command.action],
          targetType: "support_case",
          targetId: caseId,
          result: "SUCCESS",
          correlationId,
          context: {
            resultingState: invalidation.state,
            targetVersion: invalidation.version,
            ...(command.action === "reassign"
              ? { reasonCategory: String(command.body.reason) }
              : {}),
          },
        });
        return {
          version: invalidation.version,
          state: invalidation.state,
          change: invalidation.change,
        };
      },
    );
    const detail = await this.repository.detailAdmin(caseId);
    if (detail && !result.replayed) {
      await supportRealtimePublisher().publish(
        {
          caseId,
          version: result.version ?? detail.version,
          state: (result.state ?? detail.state) as typeof detail.state,
          change: (result.change ?? "MESSAGE_ADDED") as SupportChange,
        },
        detail.requesterUserId,
      );
    }
    return { ...result, data: detail };
  }
}
