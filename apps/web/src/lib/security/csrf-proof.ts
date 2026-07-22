import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnvironment } from "@/lib/env/runtime";
export function csrfProof(sessionId: string) {
  return createHmac("sha256", serverEnvironment.TOKEN_SECRET)
    .update(`csrf:${sessionId}`)
    .digest("base64url");
}
export function validCsrfProof(sessionId: string, value: string | null) {
  if (!value) return false;
  const expected = Buffer.from(csrfProof(sessionId)),
    actual = Buffer.from(value);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
