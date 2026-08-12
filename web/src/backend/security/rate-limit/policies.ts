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
  messagingDiscovery: {
    scope: "messaging-discovery",
    limit: 40,
    windowSeconds: 60,
  },
  messagingDiscoveryNetwork: {
    scope: "messaging-discovery-network",
    limit: 300,
    windowSeconds: 5 * 60,
  },
  messagingConversationCreate: {
    scope: "messaging-conversation-create",
    limit: 20,
    windowSeconds: 60,
  },
  messagingSend: { scope: "messaging-send", limit: 60, windowSeconds: 60 },
  messagingBlock: { scope: "messaging-block", limit: 20, windowSeconds: 60 },
  messagingReport: {
    scope: "messaging-report",
    limit: 10,
    windowSeconds: 24 * 60 * 60,
  },
} as const;

export function safeRetryMetadata(decision: RateLimitDecision) {
  return {
    retryAfterSeconds: Math.max(1, decision.retryAfterSeconds),
    message: "Please wait before trying again.",
  };
}
