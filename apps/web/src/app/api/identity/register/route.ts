import { registrationSchema } from "@/features/identity/schemas/registration";
import { serverEnvironment } from "@/lib/env/runtime";
import { RegisterAccountService } from "@/server/services/identity/register-account";

function trustedRequest(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(serverEnvironment.NEXT_PUBLIC_APP_URL).origin;
}

export async function POST(request: Request) {
  if (!trustedRequest(request)) return Response.json({ message: "Request rejected." }, { status: 403 });
  const parsed = registrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "Review the highlighted fields.", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  const subject = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const outcome = await new RegisterAccountService().execute(parsed.data, { subject });
  const headers = !outcome.accepted && outcome.retryAfterSeconds ? { "Retry-After": String(outcome.retryAfterSeconds) } : undefined;
  return Response.json({ message: outcome.message }, { status: outcome.accepted ? 202 : outcome.status, headers });
}
