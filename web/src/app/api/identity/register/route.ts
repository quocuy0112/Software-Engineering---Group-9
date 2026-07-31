import { registrationSchema } from "@/shared/contracts/identity/registration";
import { serverEnvironment } from "@/backend/env/runtime";
import { validateSameOrigin } from "@/backend/security/csrf/csrf";
import { noStoreHeaders } from "@/backend/security/response-headers";
import { RegisterAccountService } from "@/backend/services/identity/register-account";

export async function POST(request: Request) {
  if (!validateSameOrigin(request, serverEnvironment.NEXT_PUBLIC_APP_URL))
    return Response.json(
      { message: "Request rejected." },
      { status: 403, headers: noStoreHeaders },
    );
  const parsed = registrationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json(
      {
        message: "Review the highlighted fields.",
        fields: parsed.error.flatten().fieldErrors,
      },
      { status: 400, headers: noStoreHeaders },
    );
  const outcome = await new RegisterAccountService().execute(parsed.data, {
    subject: "anonymous",
  });
  const headers = new Headers(noStoreHeaders);
  if (!outcome.accepted && outcome.retryAfterSeconds)
    headers.set("Retry-After", String(outcome.retryAfterSeconds));
  const body =
    !outcome.accepted && outcome.status === 409
      ? { message: outcome.message, fields: { email: [outcome.message] } }
      : { message: outcome.message };
  return Response.json(body, {
    status: outcome.accepted ? 202 : outcome.status,
    headers,
  });
}
