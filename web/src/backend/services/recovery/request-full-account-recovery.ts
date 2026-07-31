import "server-only";
import { randomUUID } from "node:crypto";
import {
  rateLimitPolicies,
  safeRetryMetadata,
} from "@/backend/security/rate-limit/policies";
import { TokenProtector } from "@/backend/security/security-token/security-tokens";
import { PrismaAccountRecoveryRepository } from "@/backend/repositories/identity/prisma-account-recovery-repository";
import { PrismaRateLimitRepository } from "@/backend/repositories/rate-limit/prisma-rate-limit-repository";
import { RequestPasswordResetService } from "@/backend/services/recovery/request-password-reset";
import {
  ACCOUNT_RECOVERY_RATE_LIMIT_ERROR,
  ACCOUNT_RECOVERY_REQUEST_FAILED_ERROR,
  ACCOUNT_RECOVERY_SUCCESS_RESPONSE,
} from "@/shared/contracts/identity/password-recovery";

export class RequestFullAccountRecoveryService {
  constructor(
    private readonly repository = new PrismaAccountRecoveryRepository(),
    private readonly limiter = new PrismaRateLimitRepository(),
    private readonly protector = new TokenProtector(),
    private readonly passwordReset = new RequestPasswordResetService(),
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
        // An ACTIVE account without 2FA does not need the lower-assurance
        // 24-hour full-recovery saga. Route it through the normal reset path
        // so the user still receives a useful recovery email. Unknown,
        // inactive, or otherwise ineligible accounts remain a 404 there.
        return this.passwordReset.execute(
          normalizedEmail,
          "account-recovery-fallback",
          now,
        );
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
