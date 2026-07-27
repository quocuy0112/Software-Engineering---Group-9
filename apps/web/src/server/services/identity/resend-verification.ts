import "server-only";
import { randomUUID } from "node:crypto";
import {
  rateLimitPolicies,
  safeRetryMetadata,
} from "@/lib/rate-limit/policies";
import { TokenProtector } from "@/lib/security/security-tokens";
import { PrismaVerificationRepository } from "@/server/repositories/identity/prisma-verification-repository";
import { PrismaRateLimitRepository } from "@/server/repositories/rate-limit/prisma-rate-limit-repository";

export const GENERIC_RESEND_MESSAGE =
  "If an eligible account exists, a verification email will be sent.";

export class ResendVerificationService {
  constructor(
    private readonly repository = new PrismaVerificationRepository(),
    private readonly limiter = new PrismaRateLimitRepository(),
    private readonly protector = new TokenProtector(),
    deliveryNotUsed?: unknown,
  ) {
    void deliveryNotUsed;
  }
  async execute(normalizedEmail: string, subject: string, now = new Date()) {
    const decision = await this.limiter.consume({
      ...rateLimitPolicies.verificationResend,
      subject: `${subject}:${normalizedEmail}`,
      now,
    });
    if (!decision.allowed) {
      const { retryAfterSeconds } = safeRetryMetadata(decision);
      return {
        accepted: false as const,
        status: 429 as const,
        message: GENERIC_RESEND_MESSAGE,
        retryAfterSeconds,
      };
    }
    const raw = this.protector.generate();
    try {
      await this.repository.replaceForPendingUser({
        normalizedEmail,
        tokenDigest: this.protector.digest(raw),
        protectedToken: this.protector.seal(raw),
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        correlationId: randomUUID(),
        now,
      });
    } catch {
      // Preserve the generic response so account existence is not disclosed.
    }
    return {
      accepted: true as const,
      status: 202 as const,
      message: GENERIC_RESEND_MESSAGE,
    };
  }
}
