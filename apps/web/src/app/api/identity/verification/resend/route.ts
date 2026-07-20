import { emailSchema } from "@/features/identity/schemas/registration";
import { serverEnvironment } from "@/lib/env/runtime";
import { ResendVerificationService, GENERIC_RESEND_MESSAGE } from "@/server/services/identity/resend-verification";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(serverEnvironment.NEXT_PUBLIC_APP_URL).origin) return Response.json({ message: "Request rejected." }, { status: 403 });
  const parsed = emailSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: GENERIC_RESEND_MESSAGE }, { status: 202 });
  const subject = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const result = await new ResendVerificationService().execute(parsed.data.email, subject);
  return Response.json({ message: result.message }, { status: result.status, headers: result.accepted ? undefined : { "Retry-After": String(result.retryAfterSeconds) } });
}
