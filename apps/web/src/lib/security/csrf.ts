import { timingSafeEqual } from "node:crypto";

function equal(left: string, right: string) {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function validateSameOrigin(request: Request, trustedOrigin: string) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  return origin === new URL(trustedOrigin).origin && fetchSite === "same-origin";
}

export function validateCsrfRequest(request: Request, trustedOrigin: string, expectedProof: string) {
  const supplied = request.headers.get("x-csrf-token") ?? "";
  return validateSameOrigin(request, trustedOrigin) && supplied.length > 0 && equal(supplied, expectedProof);
}
