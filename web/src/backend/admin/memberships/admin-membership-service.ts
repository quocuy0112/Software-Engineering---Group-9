import "server-only";
import type { AdminAuthority } from "@/backend/security/admin-request-boundary";
import {
  PrismaAdminCommandRepository,
  AdminCommandConflict,
} from "@/backend/repositories/admin/prisma-admin-command-repository";
import { recordMembershipCommand } from "./admin-membership-command-transaction";
import { PrismaAdminMembershipRepository } from "@/backend/repositories/admin/prisma-admin-membership-repository";
type Command = {
  expectedVersion: number;
  idempotencyKey: string;
  reasonCategory: string;
  explanation: string;
};
export class AdminMembershipService {
  companies(input: {
    page: number;
    perPage: number;
    filter: Record<string, unknown>;
  }) {
    return new PrismaAdminMembershipRepository().companies(input);
  }
  list(input: {
    page: number;
    perPage: number;
    filter: Record<string, unknown>;
  }) {
    return new PrismaAdminMembershipRepository().list(input);
  }
  detail(membershipId: string) {
    return new PrismaAdminMembershipRepository().one(membershipId);
  }
  private run(
    authority: AdminAuthority,
    membershipId: string,
    action: "suspend" | "restore" | "remove",
    command: Command,
  ) {
    const now = new Date();
    return new PrismaAdminCommandRepository().execute(
      {
        actorUserId: authority.userId,
        actorSessionId: authority.sessionId,
        grantId: authority.grantId,
        commandKind: `membership.${action}`,
        targetReference: membershipId,
        idempotencyKey: command.idempotencyKey,
        normalizedBody: command,
      },
      async (tx, correlationId) => {
        const row = await tx.companyMembership.findUnique({
          where: { id: membershipId },
          include: { company: { select: { displayName: true } } },
        });
        if (!row) throw new Error("TARGET_UNAVAILABLE");
        if (row.version !== command.expectedVersion)
          throw new AdminCommandConflict("STALE_CONFLICT", row.version);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`feature006:company-owners:${row.companyId}`}))`;
        if (
          (action === "suspend" || action === "remove") &&
          row.status === "ACTIVE" &&
          row.role === "OWNER"
        ) {
          const owners = await tx.companyMembership.count({
            where: {
              companyId: row.companyId,
              role: "OWNER",
              status: "ACTIVE",
            },
          });
          if (owners <= 1) throw new Error("LAST_ACTIVE_OWNER");
        }
        const priorRole = row.role;
        let resultingRole = row.role;
        let resultingState: "ACTIVE" | "SUSPENDED" | "REMOVED";
        let auditAction:
          | "admin.membership_suspended"
          | "admin.membership_restored"
          | "admin.membership_removed";
        if (action === "suspend") {
          if (row.status !== "ACTIVE") throw new Error("INVALID_STATE");
          resultingState = "SUSPENDED";
          auditAction = "admin.membership_suspended";
        } else if (action === "restore") {
          if (row.status !== "SUSPENDED") throw new Error("INVALID_STATE");
          resultingState = "ACTIVE";
          resultingRole = row.priorApprovedRole ?? row.role;
          auditAction = "admin.membership_restored";
        } else {
          if (row.status === "REMOVED") throw new Error("INVALID_STATE");
          resultingState = "REMOVED";
          auditAction = "admin.membership_removed";
        }
        const version = row.version + 1;
        const claimed = await tx.companyMembership.updateMany({
          where: {
            id: row.id,
            version: command.expectedVersion,
            status: row.status,
          },
          data: {
            status: resultingState,
            role: resultingRole,
            priorApprovedRole:
              action === "suspend"
                ? row.role
                : (row.priorApprovedRole ?? row.role),
            removedAt: resultingState === "REMOVED" ? now : null,
            stateChangedAt: now,
            version,
          },
        });
        if (claimed.count !== 1)
          throw new AdminCommandConflict("STALE_CONFLICT", version);
        await recordMembershipCommand(tx, {
          correlationId,
          actorUserId: authority.userId,
          actorSessionId: authority.sessionId,
          targetUserId: row.userId,
          membershipId: row.id,
          companyId: row.companyId,
          companyDisplayName: row.company.displayName,
          action: auditAction,
          reasonCategory: command.reasonCategory,
          explanation: command.explanation,
          priorState: row.status,
          resultingState,
          priorRole,
          resultingRole,
          version,
          occurredAt: now,
        });
        return { version, state: resultingState, role: resultingRole };
      },
    );
  }
  suspend(a: AdminAuthority, id: string, c: Command) {
    return this.run(a, id, "suspend", c);
  }
  restore(a: AdminAuthority, id: string, c: Command) {
    return this.run(a, id, "restore", c);
  }
  remove(a: AdminAuthority, id: string, c: Command) {
    return this.run(a, id, "remove", c);
  }
}
