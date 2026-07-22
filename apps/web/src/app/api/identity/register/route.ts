import { registrationSchema } from "@/features/identity/schemas/registration";
import { serverEnvironment } from "@/lib/env/runtime";
import { validateSameOrigin } from "@/lib/security/csrf";
import { noStoreHeaders } from "@/lib/security/response-headers";
import { RegisterAccountService } from "@/server/services/identity/register-account";

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
  return Response.json(
    { message: outcome.message },
    { status: outcome.accepted ? 202 : outcome.status, headers },
  );
}
