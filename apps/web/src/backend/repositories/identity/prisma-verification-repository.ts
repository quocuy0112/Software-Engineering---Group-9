import "server-only";
import { prisma } from "@/backend/database/prisma";

export type VerificationResult =
  | "verified"
  | "invalid"
  | "expired"
  | "used"
  | "account_state";

export class PrismaVerificationRepository {
  async consume(
    tokenDigest: string,
    correlationId: string,
    now = new Date(),
  ): Promise<VerificationResult> {
    return prisma.$transaction(async (tx) => {
      const token = await tx.securityToken.findUnique({
        where: { tokenDigest },
        include: { user: true },
      });
      if (!token || token.purpose !== "VERIFY_EMAIL") return "invalid";
      if (token.status !== "ACTIVE") return "used";
      if (token.expiresAt <= now) {
        await tx.securityToken.updateMany({
          where: { id: token.id, status: "ACTIVE" },
          data: { status: "EXPIRED" },
        });
        return "expired";
      }
      if (token.user.state !== "PENDING_VERIFICATION") return "account_state";
      const claimed = await tx.securityToken.updateMany({
        where: { id: token.id, status: "ACTIVE", expiresAt: { gt: now } },
        data: { status: "CONSUMED", consumedAt: now },
      });
      if (claimed.count !== 1) return "used";
      const activated = await tx.userAccount.updateMany({
        where: { id: token.userId, state: "PENDING_VERIFICATION" },
        data: { state: "ACTIVE", emailVerified: true, stateChangedAt: now },
      });
      if (activated.count !== 1) throw new Error("ACCOUNT_STATE_CHANGED");
      await tx.auditEvent.create({
        data: {
          occurredAt: now,
          actorType: "anonymous",
          action: "verification.succeeded",
          targetType: "user_account",
          targetId: token.userId,
          result: "SUCCESS",
          correlationId,
          context: {},
        },
      });
      return "verified";
    });
  }

  async replaceForPendingUser(input: {
    normalizedEmail: string;
    tokenDigest: string;
    protectedToken: string;
    expiresAt: Date;
    correlationId: string;
    now?: Date;
  }): Promise<string | null> {
    const now = input.now ?? new Date();
    return prisma.$transaction(async (tx) => {
      const user = await tx.userAccount.findUnique({
        where: { normalizedEmail: input.normalizedEmail },
      });
      if (!user || user.state !== "PENDING_VERIFICATION") return null;
      await tx.securityToken.updateMany({
        where: { userId: user.id, purpose: "VERIFY_EMAIL", status: "ACTIVE" },
        data: { status: "SUPERSEDED", supersededAt: now },
      });
      const token = await tx.securityToken.create({
        data: {
          userId: user.id,
          purpose: "VERIFY_EMAIL",
          status: "ACTIVE",
          tokenDigest: input.tokenDigest,
          expiresAt: input.expiresAt,
          createdByRequestId: input.correlationId,
        },
      });
      const outbox = await tx.emailOutbox.create({
        data: {
          kind: "VERIFY_EMAIL",
          userId: user.id,
          securityTokenId: token.id,
          recipientRef: user.id,
          templateVersion: "verify-email.v1",
          payloadRef: { protectedToken: input.protectedToken },
          idempotencyKey: `verification:${token.id}`,
        },
      });
      await tx.auditEvent.create({
        data: {
          occurredAt: now,
          actorType: "anonymous",
          action: "verification.resent",
          targetType: "user_account",
          targetId: user.id,
          result: "SUCCESS",
          correlationId: input.correlationId,
          context: {},
        },
      });
      return outbox.id;
    });
  }
}
