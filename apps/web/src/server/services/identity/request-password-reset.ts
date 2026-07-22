import "server-only";
import { randomUUID } from "node:crypto";
import { rateLimitPolicies, safeRetryMetadata } from "@/lib/rate-limit/policies";
import { TokenProtector } from "@/lib/security/security-tokens";
import { PrismaRateLimitRepository } from "@/server/repositories/rate-limit/prisma-rate-limit-repository";
import { PrismaPasswordResetRepository } from "@/server/repositories/identity/prisma-password-reset-repository";

export const PASSWORD_RESET_GENERIC_RESPONSE =
  "If the account is eligible, password-reset instructions will be sent.";

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
        message: PASSWORD_RESET_GENERIC_RESPONSE,
        retryAfterSeconds,
      };
    }

    const rawToken = this.protector.generate();
    try {
      await this.repository.replaceForActiveUser({
        normalizedEmail,
        rawToken,
        protectedToken: this.protector.seal(rawToken),
        correlationId: randomUUID(),
        now,
      });
    } catch {
      // Enumeration-safe: persistence and account-state failures have the same response.
    }
    return {
      accepted: true as const,
      status: 202 as const,
      message: PASSWORD_RESET_GENERIC_RESPONSE,
    };
  }
}
