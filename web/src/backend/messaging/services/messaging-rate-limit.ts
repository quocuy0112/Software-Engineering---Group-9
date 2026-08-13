import "server-only";
import { PrismaRateLimitRepository } from "@/backend/repositories/rate-limit/prisma-rate-limit-repository";
import { rateLimitPolicies } from "@/backend/security/rate-limit/policies";
import { MessagingError } from "@/backend/messaging/messaging-errors";

type PolicyName =
  | "messagingDiscovery"
  | "messagingDiscoveryNetwork"
  | "messagingConversationCreate"
  | "messagingBlock"
  | "messagingReport";

export async function admitMessagingRequest(
  policyName: PolicyName,
  userId: string,
  limiter = new PrismaRateLimitRepository(),
) {
  const policy = rateLimitPolicies[policyName];
  const decision = await limiter.consume({ ...policy, subject: userId });
  if (!decision.allowed) {
    throw new MessagingError(
      "RATE_LIMITED",
      429,
      true,
      decision.retryAfterSeconds,
    );
  }
}
