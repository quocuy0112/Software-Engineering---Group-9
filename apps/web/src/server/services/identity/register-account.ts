import "server-only";
import { randomUUID } from "node:crypto";
import type { RegistrationData } from "@/features/identity/schemas/registration";
import { TokenProtector } from "@/lib/security/security-tokens";
import { BetterAuthGateway } from "@/server/auth/identity/better-auth-gateway";
import { PasswordPolicy } from "@/server/auth/password-policy";
import { deliverOutboxMessage } from "@/server/email/workers/email-outbox";
import { PrismaAuditRepository } from "@/server/repositories/audit/prisma-audit-repository";
import { DuplicateRegistrationError, PrismaRegistrationRepository } from "@/server/repositories/identity/prisma-registration-repository";
import { PrismaRateLimitRepository } from "@/server/repositories/rate-limit/prisma-rate-limit-repository";

export const GENERIC_REGISTRATION_MESSAGE = "If the address can be registered, check your email for the next step.";

export type RegistrationOutcome = { accepted: true; message: string } | { accepted: false; status: 400 | 429; message: string; retryAfterSeconds?: number };

export class RegisterAccountService {
  constructor(
    private readonly repository = new PrismaRegistrationRepository(),
    private readonly gateway = new BetterAuthGateway(),
    private readonly policy = new PasswordPolicy(new PrismaRateLimitRepository(), new PrismaAuditRepository()),
    private readonly protector = new TokenProtector(),
    private readonly deliver = deliverOutboxMessage,
  ) {}

  async execute(data: RegistrationData, request: { subject: string; correlationId?: string; now?: Date }): Promise<RegistrationOutcome> {
    const correlationId = request.correlationId ?? randomUUID();
    const policy = await this.policy.evaluate(data.password, { subject: `${request.subject}:${data.email}`, correlationId, now: request.now });
    if (!policy.accepted) return { accepted: false, status: policy.code === "RATE_LIMITED" ? 429 : 400, message: policy.message, retryAfterSeconds: policy.retryAfterSeconds };
    const token = this.protector.generate();
    const now = request.now ?? new Date();
    try {
      const credentialPassword = await this.gateway.preparePasswordForCredential(data.password);
      const created = await this.repository.create({
        name: data.name, email: data.email, normalizedEmail: data.email, credentialPassword,
        tokenDigest: this.protector.digest(token), protectedToken: this.protector.seal(token),
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), correlationId,
      });
      await this.deliver(created.outboxId);
    } catch (error) {
      if (!(error instanceof DuplicateRegistrationError)) {
        await new PrismaAuditRepository().append({ occurredAt: now, actorType: "anonymous", action: "registration.rejected", targetType: "request", result: "FAILURE", correlationId, context: { reason: "persistence" } }).catch(() => undefined);
      }
    }
    return { accepted: true, message: GENERIC_REGISTRATION_MESSAGE };
  }
}
