import "server-only";
import { randomUUID } from "node:crypto";
import { TokenProtector } from "@/backend/security/security-token/security-tokens";
import { PrismaVerificationRepository } from "@/backend/repositories/identity/prisma-verification-repository";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";

export class VerifyEmailService {
  constructor(
    private readonly repository = new PrismaVerificationRepository(),
    private readonly protector = new TokenProtector(),
    private readonly audit = new PrismaAuditRepository(),
  ) {}
  async execute(token: string, now = new Date()) {
    const correlationId = randomUUID();
    try {
      const result = await this.repository.consume(
        this.protector.digest(token),
        correlationId,
        now,
      );
      if (result === "verified") return { success: true as const };
      await this.audit
        .append({
          occurredAt: now,
          actorType: "anonymous",
          action: "verification.failed",
          targetType: "request",
          result: "FAILURE",
          correlationId,
          context: { reason: result },
        })
        .catch(() => undefined);
      return { success: false as const, reason: result };
    } catch {
      await this.audit
        .append({
          occurredAt: now,
          actorType: "anonymous",
          action: "verification.failed",
          targetType: "request",
          result: "FAILURE",
          correlationId,
          context: { reason: "unavailable" },
        })
        .catch(() => undefined);
      return { success: false as const, reason: "unavailable" as const };
    }
  }
}
