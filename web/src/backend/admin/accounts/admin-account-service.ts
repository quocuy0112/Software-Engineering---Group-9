import "server-only";
import type { AdminAuthority } from "@/backend/security/admin-request-boundary";
import {
  PrismaAdminCommandRepository,
  AdminCommandConflict,
} from "@/backend/repositories/admin/prisma-admin-command-repository";
import { PrismaAdminAccountRepository } from "@/backend/repositories/admin/prisma-admin-account-repository";
import { recordAccountCommand } from "./admin-account-command-transaction";
import { enforceMessagingUserRevocation } from "@/backend/messaging/realtime/messaging-authority-enforcement";
import { ProposalAuthorityInvalidationService } from "@/backend/connections/services/proposal-authority-invalidation-service";

type Command = {
  expectedVersion: number;
  idempotencyKey: string;
  reasonCategory: string;
  explanation: string;
};
export class AdminAccountService {
  security(accountId: string) {
    return new PrismaAdminAccountRepository().security(accountId);
  }
  private async run(
    authority: AdminAuthority,
    targetUserId: string,
    kind: "suspend" | "reinstate" | "revoke-all" | "revoke-one",
    command: Command,
    sessionReference?: string,
  ) {
    if (authority.userId === targetUserId)
      throw new Error("PROTECTED_ADMIN_ACTION");
    const now = new Date();
    const outcome = await new PrismaAdminCommandRepository().execute(
      {
        actorUserId: authority.userId,
        actorSessionId: authority.sessionId,
        grantId: authority.grantId,
        commandKind: `account.${kind}`,
        targetReference: sessionReference
          ? `${targetUserId}:${sessionReference}`
          : targetUserId,
        idempotencyKey: command.idempotencyKey,
        normalizedBody: command,
      },
      async (tx, correlationId) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('feature006:usable-administrators'))`;
        const account = await tx.userAccount.findUnique({
          where: { id: targetUserId },
          include: {
            platformAdministratorGrants: {
              where: {
                state: "ACTIVE",
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
              },
            },
          },
        });
        if (!account) throw new Error("TARGET_UNAVAILABLE");
        if (account.version !== command.expectedVersion)
          throw new AdminCommandConflict("STALE_CONFLICT", account.version);
        if (
          account.platformAdministratorGrants.length > 0 &&
          (kind === "suspend" || kind === "revoke-all")
        ) {
          const alternatives = await tx.platformAdministratorGrant.count({
            where: {
              userId: { not: targetUserId },
              state: "ACTIVE",
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
              user: { state: "ACTIVE" },
            },
          });
          if (alternatives === 0) throw new Error("LAST_USABLE_ADMIN");
        }
        let action:
          | "admin.account_suspended"
          | "admin.account_reinstated"
          | "admin.session_revoked"
          | "admin.sessions_revoked_all";
        const priorState = account.state;
        let resultingState = account.state;
        let notify = false;
        if (kind === "suspend") {
          if (account.state !== "ACTIVE") throw new Error("INVALID_STATE");
          const claimed = await tx.userAccount.updateMany({
            where: {
              id: targetUserId,
              version: command.expectedVersion,
              state: "ACTIVE",
            },
            data: {
              state: "SUSPENDED",
              stateChangedAt: now,
              version: { increment: 1 },
            },
          });
          if (claimed.count !== 1)
            throw new AdminCommandConflict(
              "STALE_CONFLICT",
              command.expectedVersion + 1,
            );
          await Promise.all([
            tx.session.updateMany({
              where: { userId: targetUserId, revokedAt: null },
              data: {
                revokedAt: now,
                revocationReason: "administrator_account_suspension",
              },
            }),
            tx.authenticationChallenge.updateMany({
              where: { userId: targetUserId, consumedAt: null },
              data: { consumedAt: now },
            }),
          ]);
          action = "admin.account_suspended";
          resultingState = "SUSPENDED";
          notify = true;
        } else if (kind === "reinstate") {
          if (account.state !== "SUSPENDED") throw new Error("INVALID_STATE");
          const claimed = await tx.userAccount.updateMany({
            where: {
              id: targetUserId,
              version: command.expectedVersion,
              state: "SUSPENDED",
            },
            data: {
              state: "ACTIVE",
              stateChangedAt: now,
              version: { increment: 1 },
            },
          });
          if (claimed.count !== 1)
            throw new AdminCommandConflict(
              "STALE_CONFLICT",
              command.expectedVersion + 1,
            );
          action = "admin.account_reinstated";
          resultingState = "ACTIVE";
          notify = true;
        } else if (kind === "revoke-all") {
          const claimed = await tx.userAccount.updateMany({
            where: { id: targetUserId, version: command.expectedVersion },
            data: { version: { increment: 1 } },
          });
          if (claimed.count !== 1)
            throw new AdminCommandConflict(
              "STALE_CONFLICT",
              command.expectedVersion + 1,
            );
          await tx.session.updateMany({
            where: { userId: targetUserId, revokedAt: null },
            data: {
              revokedAt: now,
              revocationReason: "administrator_revoked_all",
            },
          });
          await tx.authenticationChallenge.updateMany({
            where: { userId: targetUserId, consumedAt: null },
            data: { consumedAt: now },
          });
          action = "admin.sessions_revoked_all";
          notify = true;
        } else {
          if (!sessionReference) throw new Error("TARGET_UNAVAILABLE");
          const sessionId = await new PrismaAdminAccountRepository(
            tx,
          ).resolveSession(targetUserId, sessionReference, now);
          if (!sessionId) throw new Error("TARGET_UNAVAILABLE");
          const claimed = await tx.userAccount.updateMany({
            where: { id: targetUserId, version: command.expectedVersion },
            data: { version: { increment: 1 } },
          });
          if (claimed.count !== 1)
            throw new AdminCommandConflict(
              "STALE_CONFLICT",
              command.expectedVersion + 1,
            );
          const changed = await tx.session.updateMany({
            where: { id: sessionId, userId: targetUserId, revokedAt: null },
            data: {
              revokedAt: now,
              revocationReason: "administrator_revoked_one",
            },
          });
          if (changed.count !== 1) throw new Error("STALE_CONFLICT");
          action = "admin.session_revoked";
        }
        await recordAccountCommand(tx, {
          correlationId,
          actorUserId: authority.userId,
          actorSessionId: authority.sessionId,
          targetUserId,
          action,
          reasonCategory: command.reasonCategory,
          explanation: command.explanation,
          priorState,
          resultingState,
          resultingVersion: account.version + 1,
          occurredAt: now,
          notify,
        });
        return { version: account.version + 1, state: resultingState };
      },
    );
    if (kind === "suspend" || kind === "revoke-all" || kind === "revoke-one") {
      await enforceMessagingUserRevocation({
        userId: targetUserId,
        cause: kind === "suspend" ? "ACCOUNT" : "SESSION",
      }).catch(() => undefined);
      if (kind === "suspend") {
        await new ProposalAuthorityInvalidationService()
          .account(targetUserId)
          .catch(() => undefined);
      }
    }
    return outcome;
  }
  suspend(a: AdminAuthority, id: string, c: Command) {
    return this.run(a, id, "suspend", c);
  }
  reinstate(a: AdminAuthority, id: string, c: Command) {
    return this.run(a, id, "reinstate", c);
  }
  revokeAll(a: AdminAuthority, id: string, c: Command) {
    return this.run(a, id, "revoke-all", c);
  }
  revokeOne(a: AdminAuthority, id: string, reference: string, c: Command) {
    return this.run(a, id, "revoke-one", c, reference);
  }
}
