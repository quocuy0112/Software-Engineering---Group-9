import { loginSchema } from "@/features/identity/schemas/login";
import { validateSameOrigin } from "@/lib/security/csrf";
import { serverEnvironment } from "@/lib/env/runtime";
import { noStoreHeaders } from "@/lib/security/response-headers";
import { LoginWithPasswordService } from "@/server/services/identity/login-with-password";
export async function POST(request: Request) {
  if (!validateSameOrigin(request, serverEnvironment.NEXT_PUBLIC_APP_URL))
    return Response.json(
      { message: "Request rejected." },
      { status: 403, headers: noStoreHeaders },
    );
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      {
        message: "Review the highlighted fields.",
        fields: parsed.error.flatten().fieldErrors,
      },
      { status: 400, headers: noStoreHeaders },
    );
  return new LoginWithPasswordService().execute(parsed.data, {
    headers: request.headers,
    subject: "anonymous",
  });
}
