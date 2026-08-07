import "server-only";
import { timingSafeEqual } from "node:crypto";

function equal(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function validateSameOrigin(request: Request, trustedOrigin: string) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  return (
    origin === new URL(trustedOrigin).origin && fetchSite === "same-origin"
  );
}

/**
 * Authorizes a read-only browser fetch without requiring an Origin header.
 * Browsers commonly omit Origin on same-origin GET requests, while
 * Sec-Fetch-Site remains protected browser metadata.
 */
export function validateSameOriginRead(
  request: Request,
  trustedOrigin: string,
) {
  const expectedOrigin = new URL(trustedOrigin).origin;
  const origin = request.headers.get("origin");
  return (
    request.headers.get("sec-fetch-site") === "same-origin" &&
    (origin === null || origin === expectedOrigin)
  );
}

export function validateCsrfRequest(
  request: Request,
  trustedOrigin: string,
  expectedProof: string,
) {
  const supplied = request.headers.get("x-csrf-token") ?? "";
  return (
    validateSameOrigin(request, trustedOrigin) &&
    supplied.length > 0 &&
    equal(supplied, expectedProof)
  );
}
