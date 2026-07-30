import {
  completeTwoFactorSchema,
  TWO_FACTOR_GENERIC_ERROR,
} from "@/shared/contracts/identity/two-factor";
import { validateSameOrigin } from "@/backend/security/csrf/csrf";
import { noStoreHeaders } from "@/backend/security/response-headers";
import { serverEnvironment } from "@/backend/env/runtime";
import {
  clearPreAuthCookie,
  readPreAuthCookie,
} from "@/backend/auth/cookies/pre-auth-cookie";
import { CompleteTwoFactorService } from "@/backend/services/two-factor/complete-two-factor";
export async function POST(request: Request) {
  const safe = (status = 401, retryAfterSeconds?: number) => {
    const headers = new Headers(noStoreHeaders);
    if (retryAfterSeconds !== undefined)
      headers.set("Retry-After", String(retryAfterSeconds));
    return Response.json(
      { message: TWO_FACTOR_GENERIC_ERROR },
      { status, headers },
    );
  };
  if (!validateSameOrigin(request, serverEnvironment.NEXT_PUBLIC_APP_URL))
    return Response.json(
      { message: "Request rejected." },
      { status: 403, headers: noStoreHeaders },
    );
  const parsed = completeTwoFactorSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return safe();
  const cookie = readPreAuthCookie(request.headers);
  if (!cookie) return safe();
  const result = await new CompleteTwoFactorService().execute(
    cookie,
    parsed.data.code,
    request.headers,
    new Date(),
    parsed.data.factor,
  );
  if (!result) return safe();
  if ("rateLimited" in result) return safe(429, result.retryAfterSeconds);
  const headers = new Headers(noStoreHeaders);
  headers.append("Set-Cookie", result.sessionCookie);
  headers.append("Set-Cookie", clearPreAuthCookie());
  return Response.json({ message: "Verification complete." }, { headers });
}
