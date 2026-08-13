import "server-only";
import { PrismaRateLimitRepository } from "@/backend/repositories/rate-limit/prisma-rate-limit-repository";
import { rateLimitPolicies } from "@/backend/security/rate-limit/policies";
import { ConnectionError } from "../connection-errors";

export async function admitConnectionRequest(
  policy:
    | "connectionProposalCreate"
    | "connectionProposalDecision"
    | "connectionDisconnect",
  subject: string,
) {
  const decision = await new PrismaRateLimitRepository().consume({
    ...rateLimitPolicies[policy],
    subject,
  });
  if (!decision.allowed) {
    throw new ConnectionError("RATE_LIMITED", 429, decision.retryAfterSeconds);
  }
}
