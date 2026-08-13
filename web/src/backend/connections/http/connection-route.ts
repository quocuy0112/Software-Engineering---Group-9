import "server-only";
import type { z } from "zod";
import { ConnectionError } from "../connection-errors";

export function connectionJson(value: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store, max-age=0");
  headers.set("pragma", "no-cache");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  return Response.json(value, { ...init, headers });
}

export async function parseConnectionJson<T>(
  request: Request,
  schema: z.ZodType<T>,
) {
  if (
    !(request.headers.get("content-type") ?? "")
      .toLowerCase()
      .startsWith("application/json")
  ) {
    throw new ConnectionError("VALIDATION_ERROR", 415);
  }
  try {
    return schema.parse(await request.json());
  } catch {
    throw new ConnectionError("VALIDATION_ERROR", 400);
  }
}

export function connectionRouteError(error: unknown) {
  const safe =
    error instanceof ConnectionError
      ? error
      : new ConnectionError("TEMPORARILY_UNAVAILABLE", 503);
  return connectionJson(
    {
      error: {
        code: safe.code,
        message:
          safe.code === "RATE_LIMITED" || safe.code === "QUOTA_REACHED"
            ? "Please wait before trying again."
            : safe.code === "VALIDATION_ERROR"
              ? "The request is invalid."
              : safe.code === "AUTH_REQUIRED"
                ? "Authentication is required."
                : "This professional connection resource is unavailable.",
        retryAfterSeconds: safe.retryAfterSeconds,
        currentVersion: safe.currentVersion,
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
