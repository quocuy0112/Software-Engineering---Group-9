import "server-only";
import { z, type ZodType } from "zod";
import { requireSession } from "@/backend/auth/session/require-session";
import {
  AccountRequestError,
  accountErrorResponse,
  accountJson,
  parseBoundedJson,
  requireAccountRequest,
} from "@/backend/security/account-request-boundary";
import { noStoreHeaders } from "@/backend/security/response-headers";
import { jobProblemSchema } from "@/shared/contracts/jobs/actions";
import type { JobActor } from "@/backend/services/jobs/job-types";
import { JobServiceError } from "@/backend/services/jobs/job-types";

export async function optionalJobActor(
  headers: Headers,
  now = new Date(),
): Promise<JobActor> {
  const current = await requireSession(headers, now);
  return current ? { kind: "user", ...current } : { kind: "visitor" };
}

export async function requireJobActor(
  request: Request,
  options: { mutation?: boolean; now?: Date } = {},
) {
  return requireAccountRequest(request, {
    mutation: options.mutation ?? true,
    now: options.now ?? new Date(),
  });
}

export function jobJson(body: unknown, init: ResponseInit = {}) {
  return accountJson(body, init);
}

export function publicJobJson(
  body: unknown,
  actor: JobActor,
  init: ResponseInit = {},
) {
  const supplied = Object.fromEntries(new Headers(init.headers).entries());
  return Response.json(body, {
    ...init,
    headers:
      actor.kind === "user"
        ? { ...supplied, ...noStoreHeaders }
        : {
            ...supplied,
            "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
          },
  });
}

export function jobErrorResponse(error: unknown): Response {
  if (error instanceof JobServiceError) {
    const body = jobProblemSchema.parse(error.body);
    return jobJson(body, {
      status: error.status,
      headers: body.retryAfterSeconds
        ? { "Retry-After": String(body.retryAfterSeconds) }
        : undefined,
    });
  }
  if (error instanceof AccountRequestError) return accountErrorResponse(error);
  return jobJson(
    { code: "JOB_SERVICE_UNAVAILABLE", message: "Try again in a moment." },
    { status: 503 },
  );
}

export function zodFieldErrors(error: z.ZodError) {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues.slice(0, 25)) {
    const key = issue.path.length ? issue.path.join(".") : "request";
    fields[key] = [...new Set([...(fields[key] ?? []), issue.message])].slice(
      0,
      5,
    );
  }
  return fields;
}

export { parseBoundedJson };
export type { ZodType };
