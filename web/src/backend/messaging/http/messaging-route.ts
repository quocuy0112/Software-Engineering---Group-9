import "server-only";
import type { z } from "zod";
import { MessagingError } from "@/backend/messaging/messaging-errors";

export function messagingNoStoreHeaders(extra: HeadersInit = {}) {
  const headers = new Headers({
    "cache-control": "no-store, max-age=0",
    pragma: "no-cache",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-robots-tag": "noindex, nofollow, noarchive",
  });
  const supplied = extra instanceof Headers ? extra : new Headers(extra);
  supplied.forEach((value, key) => headers.set(key, value));
  return headers;
}

export function messagingJson(value: unknown, init: ResponseInit = {}) {
  return Response.json(value, {
    ...init,
    headers: messagingNoStoreHeaders(init.headers),
  });
}

export async function parseMessagingJson<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new MessagingError("VALIDATION_ERROR", 400);
  }
  try {
    return schema.parse(await request.json());
  } catch {
    throw new MessagingError("VALIDATION_ERROR", 400);
  }
}

const messages: Record<MessagingError["code"], string> = {
  AUTH_REQUIRED: "Authentication is required.",
  AUTHORITY_CHANGED: "Messaging access changed.",
  CONVERSATION_UNAVAILABLE: "This conversation is unavailable.",
  BLOCKED: "Messaging is unavailable for this conversation.",
  VALIDATION_ERROR: "The request is invalid.",
  RATE_LIMITED: "Please wait before trying again.",
  CONFLICT: "The conversation changed. Refresh and try again.",
  PERSISTENCE_UNAVAILABLE: "Messaging is temporarily unavailable.",
};

export function messagingRouteError(error: unknown) {
  const safe =
    error instanceof MessagingError
      ? error
      : new MessagingError("PERSISTENCE_UNAVAILABLE", 503, true);
  return messagingJson(
    {
      error: {
        code: safe.code,
        message: messages[safe.code],
        retryable: safe.retryable,
        retryAfterSeconds: safe.retryAfterSeconds,
      },
    },
    {
      status: safe.status,
      headers:
        safe.retryAfterSeconds === null
          ? undefined
          : { "retry-after": String(safe.retryAfterSeconds) },
    },
  );
}
