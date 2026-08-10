import "server-only";
import { createHmac } from "node:crypto";
import type { Session } from "@/backend/generated/prisma/client";

function key() {
  return (
    process.env.ADMIN_REFERENCE_KEY ??
    process.env.TOKEN_SECRET ??
    "test-admin-reference-key"
  );
}
export function adminSessionReference(sessionId: string) {
  return createHmac("sha256", key())
    .update(`admin-session:${sessionId}`)
    .digest("base64url")
    .slice(0, 32);
}
function device(userAgent: string | null) {
  if (!userAgent) return "Unknown browser";
  const browser = /Firefox/u.test(userAgent)
    ? "Firefox"
    : /Edg/u.test(userAgent)
      ? "Edge"
      : /Chrome/u.test(userAgent)
        ? "Chrome"
        : /Safari/u.test(userAgent)
          ? "Safari"
          : "Other browser";
  const platform = /Windows/u.test(userAgent)
    ? "Windows"
    : /Mac/u.test(userAgent)
      ? "macOS"
      : /Android/u.test(userAgent)
        ? "Android"
        : /iPhone|iPad/u.test(userAgent)
          ? "iOS"
          : "Other device";
  return `${browser} on ${platform}`;
}
export function projectAdminSession(session: Session) {
  return {
    reference: adminSessionReference(session.id),
    deviceDescription: device(session.userAgent),
    approximateLocation: null,
    createdAt: session.createdAt.toISOString(),
    lastActivityAt: session.lastActivityAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
  };
}
