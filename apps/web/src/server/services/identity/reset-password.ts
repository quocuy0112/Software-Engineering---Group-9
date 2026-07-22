import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { BetterAuthPasswordGateway } from "@/server/auth/identity/better-auth-password-gateway";
import { PrismaPasswordResetRepository } from "@/server/repositories/identity/prisma-password-reset-repository";
import { PrismaAuditRepository } from "@/server/repositories/audit/prisma-audit-repository";
import { PasswordPolicy } from "@/server/auth/password-policy";

export const RESET_PASSWORD_GENERIC_ERROR =
  "This password-reset link is invalid or has expired.";

export class ResetPasswordService {
  constructor(
    private readonly repository = new PrismaPasswordResetRepository(),
    private readonly passwordGateway = new BetterAuthPasswordGateway(),
    private readonly audit = new PrismaAuditRepository(),
    private readonly passwordPolicy = new PasswordPolicy(),
  ) {}

  async execute(rawToken: string, newPassword: string, now = new Date()) {
    const policy = await this.passwordPolicy.evaluate(newPassword);
    if (!policy.accepted) {
      return { ok: false as const, message: RESET_PASSWORD_GENERIC_ERROR };
    }
    const consumed = await this.repository.consume(rawToken, now);
    if (consumed.status !== "consumed") {
      return { ok: false as const, message: RESET_PASSWORD_GENERIC_ERROR };
    }
    const account = await prisma.userAccount.findUnique({
      where: { id: consumed.userId },
      select: { state: true },
    });
    if (!account || account.state !== "ACTIVE") {
      return { ok: false as const, message: RESET_PASSWORD_GENERIC_ERROR };
    }
    try {
      await this.passwordGateway.updatePassword(consumed.userId, newPassword);
      await this.passwordGateway.revokeAllSessions(consumed.userId);
      await prisma.authenticationChallenge.deleteMany({ where: { userId: consumed.userId } });
      await prisma.emailOutbox.upsert({
        where: { idempotencyKey: `password-changed:${consumed.tokenId}` },
        update: {},
        create: {
          kind: "PASSWORD_CHANGED",
          userId: consumed.userId,
          securityTokenId: consumed.tokenId,
          recipientRef: consumed.userId,
          templateVersion: "password-changed.v1",
          payloadRef: {},
          idempotencyKey: `password-changed:${consumed.tokenId}`,
        },
      });
      await this.audit.append({
        occurredAt: now,
        actorType: "anonymous",
        action: "password_reset.succeeded",
        targetType: "password_reset",
        targetId: consumed.tokenId,
        result: "SUCCESS",
        correlationId: randomUUID(),
        context: { sessionRevocation: "all" },
      }).catch(() => undefined);
    } catch {
      return { ok: false as const, message: RESET_PASSWORD_GENERIC_ERROR };
    }
    return { ok: true as const, userId: consumed.userId };
  }
}
