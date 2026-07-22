import "server-only";
import { prisma } from "@/lib/db/prisma";
import { TokenProtector } from "@/lib/security/security-tokens";

export const PASSWORD_RESET_LIFETIME_MS = 30 * 60 * 1000;

export type PasswordResetConsumeResult =
  | { status: "consumed"; userId: string; tokenId: string }
  | { status: "invalid" | "used" | "expired" };

export class PrismaPasswordResetRepository {
  constructor(private readonly protector = new TokenProtector()) {}

  async replaceForActiveUser(input: {
    normalizedEmail: string;
    protectedToken: string;
    rawToken: string;
    correlationId: string;
    now?: Date;
  }): Promise<{ userId: string; tokenId: string } | null> {
    const now = input.now ?? new Date();
    return prisma.$transaction(async (tx) => {
      const user = await tx.userAccount.findUnique({
        where: { normalizedEmail: input.normalizedEmail },
        select: { id: true, state: true },
      });
      if (!user || user.state !== "ACTIVE") return null;

      await tx.securityToken.updateMany({
        where: {
          userId: user.id,
          purpose: "RESET_PASSWORD",
          status: "ACTIVE",
        },
        data: { status: "SUPERSEDED", supersededAt: now },
      });
      const token = await tx.securityToken.create({
        data: {
          userId: user.id,
          purpose: "RESET_PASSWORD",
          status: "ACTIVE",
          tokenDigest: this.protector.digest(input.rawToken),
          expiresAt: new Date(now.getTime() + PASSWORD_RESET_LIFETIME_MS),
          createdByRequestId: input.correlationId,
        },
      });
      await tx.emailOutbox.create({
        data: {
          kind: "RESET_PASSWORD",
          userId: user.id,
          securityTokenId: token.id,
          recipientRef: user.id,
          templateVersion: "reset-password.v1",
          payloadRef: { protectedToken: input.protectedToken },
          idempotencyKey: `password-reset:${token.id}`,
        },
      });
      return { userId: user.id, tokenId: token.id };
    });
  }

  async consume(rawToken: string, now = new Date()): Promise<PasswordResetConsumeResult> {
    const digest = this.protector.digest(rawToken);
    return prisma.$transaction(async (tx) => {
      const token = await tx.securityToken.findUnique({
        where: { tokenDigest: digest },
        select: { id: true, userId: true, purpose: true, status: true, expiresAt: true },
      });
      if (!token || token.purpose !== "RESET_PASSWORD") return { status: "invalid" };
      if (token.status !== "ACTIVE") return { status: "used" };
      if (token.expiresAt <= now) {
        await tx.securityToken.updateMany({
          where: { id: token.id, status: "ACTIVE" },
          data: { status: "EXPIRED" },
        });
        return { status: "expired" };
      }
      const claimed = await tx.securityToken.updateMany({
        where: { id: token.id, status: "ACTIVE", expiresAt: { gt: now } },
        data: { status: "CONSUMED", consumedAt: now },
      });
      if (claimed.count !== 1) return { status: "used" };
      return { status: "consumed", userId: token.userId, tokenId: token.id };
    });
  }
}
