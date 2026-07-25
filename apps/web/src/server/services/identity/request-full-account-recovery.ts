import "server-only";
import { randomUUID } from "node:crypto";
import {
  rateLimitPolicies,
  safeRetryMetadata,
} from "@/lib/rate-limit/policies";
import { TokenProtector } from "@/lib/security/security-tokens";
import { PrismaAccountRecoveryRepository } from "@/server/repositories/identity/prisma-account-recovery-repository";
import { PrismaRateLimitRepository } from "@/server/repositories/rate-limit/prisma-rate-limit-repository";
import {
  ACCOUNT_RECOVERY_NOT_ELIGIBLE_ERROR,
  ACCOUNT_RECOVERY_RATE_LIMIT_ERROR,
  ACCOUNT_RECOVERY_REQUEST_FAILED_ERROR,
  ACCOUNT_RECOVERY_SUCCESS_RESPONSE,
} from "@/features/identity/schemas/password-recovery";

export class RequestFullAccountRecoveryService {
  constructor(
    private readonly repository = new PrismaAccountRecoveryRepository(),
    private readonly limiter = new PrismaRateLimitRepository(),
    private readonly protector = new TokenProtector(),
  ) {}

  async execute(normalizedEmail: string, now = new Date()) {
    // The normalized body field is transformed server-side and no forwarding
    // header participates in the limiter identity.
    const subject = this.protector.digest(
      `account-recovery-rate-v1\0${normalizedEmail}`,
    );
    const decision = await this.limiter.consume({
      ...rateLimitPolicies.accountRecovery,
      subject,
      now,
    });
    if (!decision.allowed) {
      return {
        accepted: false as const,
        status: 429 as const,
        message: ACCOUNT_RECOVERY_RATE_LIMIT_ERROR,
        retryAfterSeconds: safeRetryMetadata(decision).retryAfterSeconds,
      };
    }

    const rawProof = this.protector.generate();
    try {
      const recoveryRequest =
        await this.repository.replaceConfirmationForEligibleUser({
          normalizedEmail,
          rawProof,
          protectedProof: this.protector.seal(rawProof),
          correlationId: randomUUID(),
          now,
        });
      if (!recoveryRequest) {
        return {
          accepted: false as const,
          status: 404 as const,
          message: ACCOUNT_RECOVERY_NOT_ELIGIBLE_ERROR,
        };
      }
    } catch {
      return {
        accepted: false as const,
        status: 503 as const,
        message: ACCOUNT_RECOVERY_REQUEST_FAILED_ERROR,
      };
    }
    return {
      accepted: true as const,
      status: 202 as const,
      message: ACCOUNT_RECOVERY_SUCCESS_RESPONSE,
    };
  }
}
