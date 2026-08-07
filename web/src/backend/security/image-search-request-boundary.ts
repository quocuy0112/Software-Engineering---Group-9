import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { getActiveSession } from "@/backend/auth/session/get-session";
import { serverEnvironment } from "@/backend/env/runtime";
import {
  validateSameOrigin,
  validateSameOriginRead,
} from "@/backend/security/csrf/csrf";
import { validCsrfProof } from "@/backend/security/csrf/csrf-proof";

export const IMAGE_SEARCH_RATE_COOKIE = "__Host-smarthire-image-rate";

export type ImageSearchActor =
  | Readonly<{
      kind: "AUTHENTICATED";
      accountId: string;
      sessionId: string;
    }>
  | Readonly<{
      kind: "VISITOR";
      browserSubjectDigest: Uint8Array;
    }>;

export class ImageSearchRequestFailure extends Error {
  constructor(
    public readonly status: 400 | 403 | 404,
    public readonly code:
      | "INVALID_REQUEST"
      | "REQUEST_FORBIDDEN"
      | "IMAGE_SEARCH_NOT_FOUND",
  ) {
    super(code);
    this.name = "ImageSearchRequestFailure";
  }
}

function strictHeader(
  headers: Headers,
  name: string,
  pattern: RegExp,
  required: boolean,
): string | null {
  const value = headers.get(name);
  if (!value) {
    if (required) throw new ImageSearchRequestFailure(400, "INVALID_REQUEST");
    return null;
  }
  if (!pattern.test(value)) {
    throw new ImageSearchRequestFailure(400, "INVALID_REQUEST");
  }
  return value;
}

function parseCookie(headers: Headers, name: string): string | null {
  const cookies = headers.get("cookie") ?? "";
  for (const part of cookies.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return null;
}

function digest(key: Uint8Array, label: string, value: string): Buffer {
  return createHmac("sha256", key).update(`${label}:${value}`, "utf8").digest();
}

export function issueImageSearchRateCookie(): {
  value: string;
  serialized: string;
} {
  const value = randomBytes(32).toString("base64url");
  return {
    value,
    serialized: `${IMAGE_SEARCH_RATE_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`,
  };
}

export async function enforceImageSearchRequestBoundary(
  request: Request,
  input: Readonly<{
    mutation: boolean;
    requireIdempotency?: boolean;
    capabilityRequiredForVisitor?: boolean;
    rateHmacKey: Uint8Array;
  }>,
): Promise<{
  actor: ImageSearchActor;
  idempotencyKey: string | null;
  visitorCapability: string | null;
  newRateCookie: string | null;
}> {
  const sameOrigin = input.mutation
    ? validateSameOrigin(request, serverEnvironment.NEXT_PUBLIC_APP_URL)
    : validateSameOriginRead(request, serverEnvironment.NEXT_PUBLIC_APP_URL);
  if (!sameOrigin) {
    throw new ImageSearchRequestFailure(403, "REQUEST_FORBIDDEN");
  }
  const idempotencyKey = strictHeader(
    request.headers,
    "idempotency-key",
    /^[\x21-\x7e]{16,128}$/u,
    input.requireIdempotency ?? false,
  );
  const current = await getActiveSession(request.headers);
  if (current) {
    if (
      input.mutation &&
      !validCsrfProof(current.session.id, request.headers.get("x-csrf-token"))
    ) {
      throw new ImageSearchRequestFailure(403, "REQUEST_FORBIDDEN");
    }
    if (request.headers.has("x-image-search-capability")) {
      throw new ImageSearchRequestFailure(400, "INVALID_REQUEST");
    }
    return {
      actor: {
        kind: "AUTHENTICATED",
        accountId: current.user.id,
        sessionId: current.session.id,
      },
      idempotencyKey,
      visitorCapability: null,
      newRateCookie: null,
    };
  }
  const capability = strictHeader(
    request.headers,
    "x-image-search-capability",
    /^[A-Za-z0-9_-]{43,128}$/u,
    input.capabilityRequiredForVisitor ?? false,
  );
  const existingCookie = parseCookie(request.headers, IMAGE_SEARCH_RATE_COOKIE);
  const issued = existingCookie ? null : issueImageSearchRateCookie();
  const browserValue = existingCookie ?? issued!.value;
  return {
    actor: {
      kind: "VISITOR",
      browserSubjectDigest: digest(
        input.rateHmacKey,
        "image-search-browser-v1",
        browserValue,
      ),
    },
    idempotencyKey,
    visitorCapability: capability,
    newRateCookie: issued?.serialized ?? null,
  };
}

export function verifyVisitorCapability(input: {
  queryId: string;
  capability: string;
  expectedDigest: Uint8Array;
  capabilityHmacKey: Uint8Array;
}): boolean {
  const actual = digest(
    input.capabilityHmacKey,
    `image-search-capability-v1:${input.queryId}`,
    input.capability,
  );
  const expected = Buffer.from(input.expectedDigest);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function imageSearchIdempotencyDigest(input: {
  actorBinding: Uint8Array;
  idempotencyKey: string;
  hmacKey: Uint8Array;
}): Buffer {
  return createHmac("sha256", input.hmacKey)
    .update("image-search-idempotency-v1")
    .update(input.actorBinding)
    .update(input.idempotencyKey, "utf8")
    .digest();
}
