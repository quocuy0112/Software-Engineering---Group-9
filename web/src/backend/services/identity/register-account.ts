import "server-only";
import { randomUUID } from "node:crypto";
import type { RegistrationData } from "@/shared/contracts/identity/registration";
import { TokenProtector } from "@/backend/security/security-token/security-tokens";
import { BetterAuthGateway } from "@/backend/auth/better-auth/better-auth-gateway";
import { PasswordPolicy } from "@/backend/auth/policy/password-policy";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import {
  DuplicateRegistrationError,
  PrismaRegistrationRepository,
} from "@/backend/repositories/identity/prisma-registration-repository";
import { PrismaRateLimitRepository } from "@/backend/repositories/rate-limit/prisma-rate-limit-repository";

export const GENERIC_REGISTRATION_MESSAGE =
  "If the address can be registered, check your email for the next step.";

export type RegistrationOutcome =
  | { accepted: true; message: string }
  | {
      accepted: false;
      status: 400 | 429;
      message: string;
      retryAfterSeconds?: number;
    };

export class RegisterAccountService {
  constructor(
    private readonly repository = new PrismaRegistrationRepository(),
    private readonly gateway = new BetterAuthGateway(),
    private readonly policy = new PasswordPolicy(
      new PrismaRateLimitRepository(),
      new PrismaAuditRepository(),
    ),
    private readonly protector = new TokenProtector(),
    deliveryNotUsed?: unknown,
    private readonly audit = new PrismaAuditRepository(),
  ) {
    void deliveryNotUsed;
  }

  async execute(
    data: RegistrationData,
    request: { subject: string; correlationId?: string; now?: Date },
  ): Promise<RegistrationOutcome> {
    const correlationId = request.correlationId ?? randomUUID();
    const policy = await this.policy.evaluate(data.password, {
      subject: `${request.subject}:${data.email}`,
      correlationId,
      now: request.now,
    });
    if (!policy.accepted) {
      await this.audit
        .append({
          occurredAt: request.now ?? new Date(),
          actorType: "anonymous",
          action: "registration.rejected",
          targetType: "request",
          result: "DENIED",
          correlationId,
          context: { reason: policy.code.toLowerCase() },
        })
        .catch(() => undefined);
      return {
        accepted: false,
        status: policy.code === "RATE_LIMITED" ? 429 : 400,
        message: policy.message,
        retryAfterSeconds: policy.retryAfterSeconds,
      };
    }
    const token = this.protector.generate();
    const now = request.now ?? new Date();
    try {
      const credentialPassword =
        await this.gateway.preparePasswordForCredential(data.password);
      await this.repository.create({
        name: data.name,
        email: data.email,
        normalizedEmail: data.email,
        credentialPassword,
        tokenDigest: this.protector.digest(token),
        protectedToken: this.protector.seal(token),
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        correlationId,
        now,
      });
      await this.audit
        .append({
          occurredAt: now,
          actorType: "anonymous",
          action: "registration.accepted",
          targetType: "request",
          result: "SUCCESS",
          correlationId,
          context: { reason: "accepted" },
        })
        .catch(() => undefined);
    } catch (error) {
      await this.audit
        .append({
          occurredAt: now,
          actorType: "anonymous",
          action: "registration.rejected",
          targetType: "request",
          result: "FAILURE",
          correlationId,
          context: {
            reason:
              error instanceof DuplicateRegistrationError
                ? "duplicate"
                : "persistence",
          },
        })
        .catch(() => undefined);
    }
    return { accepted: true, message: GENERIC_REGISTRATION_MESSAGE };
  }
}
