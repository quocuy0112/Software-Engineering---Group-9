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
export const EMAIL_ALREADY_REGISTERED_MESSAGE =
  "An account with this email already exists.";
export const REGISTRATION_FAILED_MESSAGE =
  "Registration is temporarily unavailable. Please try again.";

export type RegistrationOutcome =
  | { accepted: true; message: string }
  | {
      accepted: false;
      status: 400 | 409 | 429 | 503;
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
      if (error instanceof DuplicateRegistrationError) {
        return {
          accepted: false,
          status: 409,
          message: EMAIL_ALREADY_REGISTERED_MESSAGE,
        };
      }
      return {
        accepted: false,
        status: 503,
        message: REGISTRATION_FAILED_MESSAGE,
      };
    }
    return { accepted: true, message: GENERIC_REGISTRATION_MESSAGE };
  }
}
