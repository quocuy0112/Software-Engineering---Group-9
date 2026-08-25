import { serverEnvironment } from "@/backend/env/runtime";
import {
  AccountRequestError,
  accountErrorResponse,
  accountJson,
  requireAccountRequest,
} from "@/backend/security/account-request-boundary";
import { NetworkSourceProtector } from "@/backend/security/network-source/network-source-protector";
import {
  CandidateProfileDiscoveryService,
  ProfileDiscoveryRateLimitError,
} from "@/backend/services/profile/candidate-profile-discovery";
import {
  profileLookupQuerySchema,
  profileLookupResponseSchema,
} from "@/shared/contracts/profile-discovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function networkSubject(request: Request) {
  return new NetworkSourceProtector().protect({
    remoteAddress:
      request.headers.get("x-real-ip") ??
      (serverEnvironment.APP_ENV === "production" ? null : "127.0.0.1"),
    forwardedFor: request.headers.get("x-forwarded-for"),
  }).ipPrefixDigest;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await requireAccountRequest(request);
    const query = profileLookupQuerySchema.parse({
      userId: new URL(request.url).searchParams.get("userId") ?? undefined,
    });
    const ipPrefixDigest = networkSubject(request);
    const result = await new CandidateProfileDiscoveryService().execute({
      actorUserId: actor.userId,
      networkSubject: ipPrefixDigest,
      targetUserId: query.userId,
      ipPrefixDigest,
    });
    return accountJson(profileLookupResponseSchema.parse({ result }));
  } catch (error) {
    if (error instanceof ProfileDiscoveryRateLimitError) {
      return accountErrorResponse(
        new AccountRequestError(429, {
          code: "RATE_LIMITED",
          message: "Please wait before trying again.",
          retryAfterSeconds: error.retryAfterSeconds,
        }),
      );
    }
    return accountErrorResponse(error);
  }
}
