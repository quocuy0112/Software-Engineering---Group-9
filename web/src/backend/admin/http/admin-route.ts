import "server-only";
import type { z } from "zod";
import { AdminBoundaryError } from "@/backend/security/admin-request-boundary";
import { AdminCommandConflict } from "@/backend/repositories/admin/prisma-admin-command-repository";

export function adminNoStoreHeaders(extra: HeadersInit = {}) {
  return new Headers({
    "cache-control": "no-store, max-age=0",
    pragma: "no-cache",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-robots-tag": "noindex, nofollow, noarchive",
    ...Object.fromEntries(new Headers(extra)),
  });
}

export async function parseAdminJson<T>(
  request: Request,
  schema: z.ZodType<T>,
) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new AdminHttpError(415, "VALIDATION_FAILED");
  }
  return schema.parse(await request.json());
}

export class AdminHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

export function adminJson(value: unknown, init: ResponseInit = {}) {
  return Response.json(value, {
    ...init,
    headers: adminNoStoreHeaders(init.headers),
  });
}

export function adminRouteError(error: unknown) {
  if (error instanceof AdminBoundaryError) {
    return adminJson({ code: error.code }, { status: error.status });
  }
  if (error instanceof AdminHttpError) {
    return adminJson(
      {
        code: error.code,
        ...(error.details ? { details: error.details } : {}),
      },
      { status: error.status },
    );
  }
  if (error instanceof AdminCommandConflict) {
    return adminJson(
      { code: error.code, currentVersion: error.currentVersion },
      { status: 409 },
    );
  }
  if (error instanceof Error) {
    const known: Record<string, number> = {
      UNAUTHORIZED: 401,
      TARGET_UNAVAILABLE: 404,
      INVALID_STATE: 409,
      STALE_CONFLICT: 409,
      LAST_USABLE_ADMIN: 409,
      PROTECTED_ADMIN_ACTION: 409,
      LAST_ACTIVE_OWNER: 409,
      RATIONALE_LENGTH_INVALID: 400,
      STEP_UP_REQUIRED: 403,
      FILE_SIZE_INVALID: 400,
      DUPLICATE_AUTHORITY: 409,
      RELATIONSHIP_REQUIRED: 404,
      PREREQUISITE_INTEGRATION_UNAVAILABLE: 503,
      EVIDENCE_UNAVAILABLE: 409,
      RESUBMISSION_LIMIT: 409,
    };
    if (known[error.message])
      return adminJson(
        { code: error.message },
        { status: known[error.message] },
      );
    if (error.message === "REPORT_TARGET_UNAVAILABLE")
      return adminJson({ code: "UNAVAILABLE" }, { status: 404 });
    if (error.message === "RATE_LIMITED")
      return adminJson(
        {
          code: "RATE_LIMITED",
          retryAfterSeconds: (error as Error & { retryAfterSeconds?: number })
            .retryAfterSeconds,
        },
        { status: 429 },
      );
  }
  if (error && typeof error === "object" && "issues" in error) {
    return adminJson({ code: "VALIDATION_FAILED" }, { status: 400 });
  }
  return adminJson({ code: "INTERNAL_FAILURE" }, { status: 500 });
}

export function commandHeaders(request: Request) {
  return {
    idempotencyKey: request.headers.get("idempotency-key") ?? "",
    expectedVersion: Number(request.headers.get("if-match-version") ?? NaN),
  };
}

export function adminListQuery(request: Request) {
  const query = new URL(request.url).searchParams;
  let filter: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(query.get("filter") ?? "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      filter = parsed as Record<string, unknown>;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }
  return {
    page: Math.max(1, Number(query.get("page") ?? 1)),
    perPage: Math.min(100, Math.max(1, Number(query.get("perPage") ?? 25))),
    filter,
  };
}
