import "server-only";
import { PrismaRateLimitRepository } from "@/backend/repositories/rate-limit/prisma-rate-limit-repository";
import { rateLimitPolicies } from "@/backend/security/rate-limit/policies";
import { SupportError } from "../support-errors";

export async function admitSupportRequest(
  policy: "supportCaseCreate" | "supportSend" | "supportSendNetwork",
  subject: string,
) {
  const selected = rateLimitPolicies[policy];
  const decision = await new PrismaRateLimitRepository().consume({
    ...selected,
    subject,
  });
  if (!decision.allowed) {
    throw new SupportError(
      "RATE_LIMITED",
      429,
      false,
      decision.retryAfterSeconds,
    );
  }
}

export function supportNetworkSubject(request: Request) {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unavailable";
}
