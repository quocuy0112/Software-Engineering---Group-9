import "server-only";

import type { ZodIssue, ZodType } from "zod";

import { requireSession } from "@/backend/auth/session/require-session";
import { prisma } from "@/backend/database/prisma";
import { serverEnvironment } from "@/backend/env/runtime";
import { validCsrfProof } from "@/backend/security/csrf/csrf-proof";
import { validateSameOrigin } from "@/backend/security/csrf/csrf";
import { noStoreHeaders } from "@/backend/security/response-headers";
import type { CvApiError } from "@/shared/contracts/cv-import/common";

type CvApiErrorCode = CvApiError["error"]["code"];
type SessionResolution =
  | Readonly<{
      state: "VALID";
      accountId: string;
      sessionId: string;
    }>
  | Readonly<{
      state: "MISSING" | "EXPIRED" | "REVOKED" | "PASSWORD_RESET_REVOKED";
    }>;
type CvResourceType = "upload" | "artifact" | "job" | "draft" | "confirmation";

export type CvAuthenticatedAccountContext = Readonly<{
  accountId: string;
  sessionId: string;
}>;

export type CvRequestBoundaryDependencies = Readonly<{
  trustedOrigin: string;
  resolveSession(request: Request): Promise<SessionResolution>;
  getAccountState(accountId: string): Promise<string | null>;
  owns(input: {
    accountId: string;
    resourceId: string;
    resourceType?: CvResourceType;
  }): Promise<boolean>;
}>;

export class CvRequestBoundaryError extends Error {
  readonly name = "CvRequestBoundaryError";

  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415,
    readonly code: CvApiErrorCode,
    message = "The request could not be completed.",
    readonly fieldErrors: CvApiError["error"]["fieldErrors"] = [],
  ) {
    super(message);
  }

  toJSON() {
    return { name: this.name, code: this.code, status: this.status };
  }
}

const forbiddenRequestKeys = new Set([
  "accountid",
  "ownerid",
  "userid",
  "sessionid",
  "providerurl",
  "providerendpoint",
  "providerrequest",
  "providerresponse",
  "storagelocator",
  "storagekey",
  "storagepath",
]);

function firstForbiddenPath(value: unknown, path = "request"): string | null {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = firstForbiddenPath(value[index], `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = `${path}.${key}`;
    if (forbiddenRequestKeys.has(key.toLowerCase())) return childPath;
    const found = firstForbiddenPath(child, childPath);
    if (found) return found;
  }
  return null;
}

function validationError(
  path = "request",
  message = "Review the highlighted fields.",
): CvRequestBoundaryError {
  return new CvRequestBoundaryError(400, "VALIDATION_ERROR", message, [
    { path, code: "INVALID", message: "Enter a valid value." },
  ]);
}

async function defaultOwns(input: {
  accountId: string;
  resourceId: string;
  resourceType?: CvResourceType;
}): Promise<boolean> {
  switch (input.resourceType) {
    case "upload":
      return Boolean(
        await prisma.cvUpload.findFirst({
          where: { id: input.resourceId, accountId: input.accountId },
          select: { id: true },
        }),
      );
    case "artifact":
      return Boolean(
        await prisma.cvStoredArtifact.findFirst({
          where: {
            id: input.resourceId,
            upload: { accountId: input.accountId },
          },
          select: { id: true },
        }),
      );
    case "job":
      return Boolean(
        await prisma.cvParseJob.findFirst({
          where: { id: input.resourceId, accountId: input.accountId },
          select: { id: true },
        }),
      );
    case "draft":
      return Boolean(
        await prisma.cvDraft.findFirst({
          where: { id: input.resourceId, accountId: input.accountId },
          select: { id: true },
        }),
      );
    case "confirmation":
      return Boolean(
        await prisma.cvImportConfirmation.findFirst({
          where: { id: input.resourceId, accountId: input.accountId },
          select: { id: true },
        }),
      );
    default:
      return false;
  }
}

const defaultDependencies: CvRequestBoundaryDependencies = {
  trustedOrigin: serverEnvironment.NEXT_PUBLIC_APP_URL,
  async resolveSession(request) {
    const session = await requireSession(request.headers);
    return session
      ? {
          state: "VALID",
          accountId: session.userId,
          sessionId: session.sessionId,
        }
      : { state: "MISSING" };
  },
  async getAccountState(accountId) {
    const account = await prisma.userAccount.findUnique({
      where: { id: accountId },
      select: { state: true },
    });
    return account?.state ?? null;
  },
  owns: defaultOwns,
};

export class CvAccountRequestBoundary {
  constructor(
    private readonly dependencies: CvRequestBoundaryDependencies = defaultDependencies,
  ) {}

  async authorize(
    request: Request,
    options: Readonly<{
      mutation?: boolean;
      resource?: Readonly<{ type: CvResourceType; id: string }>;
    }> = {},
  ): Promise<CvAuthenticatedAccountContext> {
    const session = await this.dependencies.resolveSession(request);
    if (session.state !== "VALID") {
      throw new CvRequestBoundaryError(
        401,
        "AUTHENTICATION_REQUIRED",
        "Sign in to continue.",
      );
    }
    if (
      options.mutation &&
      (!validateSameOrigin(request, this.dependencies.trustedOrigin) ||
        !validCsrfProof(session.sessionId, request.headers.get("x-csrf-token")))
    ) {
      throw new CvRequestBoundaryError(
        403,
        "CSRF_REJECTED",
        "Refresh the page and try again.",
      );
    }
    if (
      (await this.dependencies.getAccountState(session.accountId)) !== "ACTIVE"
    ) {
      throw new CvRequestBoundaryError(
        403,
        "FORBIDDEN",
        "This account cannot perform that action.",
      );
    }
    if (
      options.resource &&
      !(await this.dependencies.owns({
        accountId: session.accountId,
        resourceId: options.resource.id,
        resourceType: options.resource.type,
      }))
    ) {
      throw new CvRequestBoundaryError(
        404,
        options.resource.type === "draft"
          ? "CV_DRAFT_NOT_FOUND"
          : "CV_IMPORT_NOT_FOUND",
        options.resource.type === "draft"
          ? "CV draft not found."
          : "CV import not found.",
      );
    }
    return { accountId: session.accountId, sessionId: session.sessionId };
  }

  async readJson<T>(
    request: Request,
    schema: ZodType<T>,
    maximumBytes: number,
    options: Readonly<{
      validationMessage?: (issue: ZodIssue) => string | undefined;
    }> = {},
  ): Promise<T> {
    if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
      throw new Error("CV_JSON_BODY_LIMIT_INVALID");
    }
    const declaredLength = request.headers.get("content-length");
    if (
      declaredLength &&
      (!/^\d+$/u.test(declaredLength) || Number(declaredLength) > maximumBytes)
    ) {
      throw new CvRequestBoundaryError(
        413,
        "PAYLOAD_TOO_LARGE",
        "The request is too large.",
      );
    }
    if (
      !request.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("application/json")
    ) {
      throw new CvRequestBoundaryError(
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "Send a JSON request.",
      );
    }
    let text: string;
    try {
      text = await request.text();
    } catch {
      throw validationError();
    }
    if (new TextEncoder().encode(text).byteLength > maximumBytes) {
      throw new CvRequestBoundaryError(
        413,
        "PAYLOAD_TOO_LARGE",
        "The request is too large.",
      );
    }
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw validationError();
    }
    const forbiddenPath = firstForbiddenPath(value);
    if (forbiddenPath) throw validationError(forbiddenPath);
    const result = schema.safeParse(value);
    if (!result.success) {
      const issue = result.error.issues[0];
      throw validationError(
        issue?.path.length ? issue.path.join(".") : "request",
        issue ? options.validationMessage?.(issue) : undefined,
      );
    }
    return result.data;
  }

  async readRaw(
    request: Request,
    options: Readonly<{ maximumBytes: number; expectedBytes: number }>,
  ): Promise<Uint8Array> {
    const { maximumBytes, expectedBytes } = options;
    if (
      !Number.isSafeInteger(maximumBytes) ||
      maximumBytes < 1 ||
      !Number.isSafeInteger(expectedBytes) ||
      expectedBytes < 1 ||
      expectedBytes > maximumBytes
    ) {
      throw new CvRequestBoundaryError(
        413,
        "PAYLOAD_TOO_LARGE",
        "The request is too large.",
      );
    }
    const contentLength = request.headers.get("content-length");
    if (!contentLength || !/^\d+$/u.test(contentLength))
      throw validationError();
    if (Number(contentLength) !== expectedBytes) throw validationError();
    if (!request.body) throw validationError();

    const chunks: Uint8Array[] = [];
    let received = 0;
    const reader = request.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > maximumBytes || received > expectedBytes) {
          await reader.cancel().catch(() => undefined);
          throw new CvRequestBoundaryError(
            413,
            "PAYLOAD_TOO_LARGE",
            "The request is too large.",
          );
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    if (received !== expectedBytes) throw validationError();
    const result = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return result;
  }
}

export async function assertCvEmptyRequestBody(
  request: Request,
): Promise<void> {
  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength &&
    (!/^\d+$/u.test(declaredLength) || Number(declaredLength) !== 0)
  ) {
    throw validationError();
  }
  if (!request.body) return;

  const reader = request.body.getReader();
  try {
    while (true) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        throw validationError();
      }
      if (chunk.done) return;
      if (chunk.value.byteLength > 0) {
        await reader.cancel().catch(() => undefined);
        throw validationError();
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function cvJsonResponse(
  body: unknown,
  init: ResponseInit = {},
): Response {
  return Response.json(body, {
    ...init,
    headers: {
      ...Object.fromEntries(new Headers(init.headers).entries()),
      ...noStoreHeaders,
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}
