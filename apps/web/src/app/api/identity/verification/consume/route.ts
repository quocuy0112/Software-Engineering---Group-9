import { verificationTokenSchema } from "@/features/identity/schemas/registration";
import { serverEnvironment } from "@/lib/env/runtime";
import { noStoreHeaders } from "@/lib/security/response-headers";
import { VerifyEmailService } from "@/server/services/identity/verify-email";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (
    origin &&
    origin !== new URL(serverEnvironment.NEXT_PUBLIC_APP_URL).origin
  )
    return Response.json(
      { status: "failure" },
      { status: 403, headers: noStoreHeaders },
    );
  const parsed = verificationTokenSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json(
      { status: "failure" },
      { status: 400, headers: noStoreHeaders },
    );
  const result = await new VerifyEmailService().execute(parsed.data.token);
  return Response.json(
    { status: result.success ? "success" : "failure" },
    {
      status: result.success ? 200 : 400,
      headers: noStoreHeaders,
    },
  );
}
