import "server-only";
import { randomUUID } from "node:crypto";
import {
  PASSWORD_RECOVERY_ACCOUNT_NOT_FOUND_ERROR,
  PASSWORD_RECOVERY_RATE_LIMIT_ERROR,
  PASSWORD_RECOVERY_REQUEST_FAILED_ERROR,
  PASSWORD_RECOVERY_SUCCESS_RESPONSE,
} from "@/shared/contracts/identity/password-recovery";
import { rateLimitPolicies, safeRetryMetadata } from "@/backend/security/rate-limit/policies";
import { TokenProtector } from "@/backend/security/security-token/security-tokens";
import { PrismaRateLimitRepository } from "@/backend/repositories/rate-limit/prisma-rate-limit-repository";
import { PrismaPasswordResetRepository } from "@/backend/repositories/identity/prisma-password-reset-repository";

export class RequestPasswordResetService {
  constructor(
    private readonly repository = new PrismaPasswordResetRepository(),
    private readonly limiter = new PrismaRateLimitRepository(),
    private readonly protector = new TokenProtector(),
  ) {}

  async execute(normalizedEmail: string, subject: string, now = new Date()) {
    const decision = await this.limiter.consume({
      ...rateLimitPolicies.passwordReset,
      subject: `${subject}:${normalizedEmail}`,
      now,
    });
    if (!decision.allowed) {
      const { retryAfterSeconds } = safeRetryMetadata(decision);
      return {
        accepted: false as const,
        status: 429 as const,
        message: PASSWORD_RECOVERY_RATE_LIMIT_ERROR,
        retryAfterSeconds,
      };
    }

    const rawToken = this.protector.generate();
    try {
      const resetRequest = await this.repository.replaceForActiveUser({
        normalizedEmail,
        rawToken,
        protectedToken: this.protector.seal(rawToken),
        correlationId: randomUUID(),
        now,
      });
      if (!resetRequest) {
        return {
          accepted: false as const,
          status: 404 as const,
          message: PASSWORD_RECOVERY_ACCOUNT_NOT_FOUND_ERROR,
        };
      }
    } catch {
      return {
        accepted: false as const,
        status: 503 as const,
        message: PASSWORD_RECOVERY_REQUEST_FAILED_ERROR,
      };
    }
    return {
      accepted: true as const,
      status: 202 as const,
      message: PASSWORD_RECOVERY_SUCCESS_RESPONSE,
    };
  }
}
