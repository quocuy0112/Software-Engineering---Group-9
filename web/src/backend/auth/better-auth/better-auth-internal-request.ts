import "server-only";

type RateLimitRule = { window: number; max: number };

const internalRequests = new WeakSet<Request>();

export function markInternalBetterAuthRequest(request: Request): Request {
  internalRequests.add(request);
  return request;
}

export function preserveExternalBetterAuthSignInRateLimit(
  request: Request,
  currentRule: RateLimitRule,
): false | RateLimitRule {
  return internalRequests.has(request) ? false : currentRule;
}
