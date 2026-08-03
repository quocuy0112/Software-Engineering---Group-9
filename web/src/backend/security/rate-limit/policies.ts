import type { RateLimitDecision } from "@/backend/repositories/rate-limit/prisma-rate-limit-repository";

export const rateLimitPolicies = {
  registration: { scope: "registration", limit: 5, windowSeconds: 5 * 60 },
  login: { scope: "login", limit: 5, windowSeconds: 5 * 60 },
  verificationResend: {
    scope: "verification-resend",
    limit: 3,
    windowSeconds: 60 * 60,
  },
  passwordReset: { scope: "password-reset", limit: 3, windowSeconds: 10 * 60 },
  accountRecovery: {
    scope: "account-recovery",
    limit: 3,
    windowSeconds: 10 * 60,
  },
  totpChallenge: { scope: "totp-challenge", limit: 5, windowSeconds: 10 * 60 },
  totpEnrollment: {
    scope: "totp-enrollment",
    limit: 5,
    windowSeconds: 10 * 60,
  },
  jobReport: { scope: "job-report", limit: 10, windowSeconds: 60 * 60 },
} as const;

export function safeRetryMetadata(decision: RateLimitDecision) {
  return {
    retryAfterSeconds: Math.max(1, decision.retryAfterSeconds),
    message: "Please wait before trying again.",
  };
}
