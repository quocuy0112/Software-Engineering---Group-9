import { emailSchema } from "@/features/identity/schemas/registration";
import { validateSameOrigin } from "@/lib/security/csrf";
import { serverEnvironment } from "@/lib/env/runtime";
import { noStoreHeaders } from "@/lib/security/response-headers";
import {
  ResendVerificationService,
  GENERIC_RESEND_MESSAGE,
} from "@/server/services/identity/resend-verification";

export async function POST(request: Request) {
  if (!validateSameOrigin(request, serverEnvironment.NEXT_PUBLIC_APP_URL))
    return Response.json(
      { message: "Request rejected." },
      { status: 403, headers: noStoreHeaders },
    );
  const parsed = emailSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { message: GENERIC_RESEND_MESSAGE },
      { status: 202, headers: noStoreHeaders },
    );
  const result = await new ResendVerificationService().execute(
    parsed.data.email,
    "anonymous",
  );
  const headers = new Headers(noStoreHeaders);
  if (!result.accepted)
    headers.set("Retry-After", String(result.retryAfterSeconds));
  return Response.json(
    { message: result.message },
    { status: result.status, headers },
  );
}
