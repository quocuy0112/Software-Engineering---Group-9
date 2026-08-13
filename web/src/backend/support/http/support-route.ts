import "server-only";
import type { z } from "zod";
import { SupportError } from "../support-errors";

export function supportNoStoreHeaders(extra: HeadersInit = {}) {
  const headers = new Headers({
    "cache-control": "no-store, max-age=0",
    pragma: "no-cache",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-robots-tag": "noindex, nofollow, noarchive",
  });
  new Headers(extra).forEach((value, key) => headers.set(key, value));
  return headers;
}

export function supportJson(value: unknown, init: ResponseInit = {}) {
  return Response.json(value, {
    ...init,
    headers: supportNoStoreHeaders(init.headers),
  });
}

export async function parseSupportJson<T>(
  request: Request,
  schema: z.ZodType<T>,
) {
  if (
    !(request.headers.get("content-type") ?? "")
      .toLowerCase()
      .startsWith("application/json")
  ) {
    throw new SupportError("VALIDATION_ERROR", 415);
  }
  try {
    return schema.parse(await request.json());
  } catch {
    throw new SupportError("VALIDATION_ERROR", 400);
  }
}

export function supportRouteError(error: unknown) {
  const safe =
    error instanceof SupportError
      ? error
      : new SupportError("PERSISTENCE_UNAVAILABLE", 503, true);
  return supportJson(
    {
      error: {
        code: safe.code,
        message:
          safe.code === "RATE_LIMITED"
            ? "Please wait before trying again."
            : safe.code === "ACTIVE_CASE_LIMIT"
              ? "Close or resolve an existing support case before creating another."
              : safe.code === "VALIDATION_ERROR"
                ? "The support request is invalid."
                : safe.code === "AUTH_REQUIRED"
                  ? "Authentication is required."
                  : safe.code === "PERSISTENCE_UNAVAILABLE"
                    ? "Support is temporarily unavailable."
                    : "This support case is unavailable.",
        retryable: safe.retryable,
        retryAfterSeconds: safe.retryAfterSeconds,
      },
    },
    {
      status: safe.status,
      headers: safe.retryAfterSeconds
        ? { "retry-after": String(safe.retryAfterSeconds) }
        : undefined,
    },
  );
}
