import {
  accountRecoveryCapabilitySchema,
  ACCOUNT_RECOVERY_GENERIC_ERROR,
} from "@/features/identity/schemas/password-recovery";
import { serverEnvironment } from "@/lib/env/runtime";
import {
  clearAccountRecoveryCapability,
  issueAccountRecoveryCapability,
} from "@/lib/security/account-recovery-capability";
import { validateSameOrigin } from "@/lib/security/csrf";
import { noStoreHeaders } from "@/lib/security/response-headers";
import { AuthorizeAccountRecoveryRouteService } from "@/server/services/identity/authorize-account-recovery-route";

function rejected(status: 400 | 403) {
  const headers = new Headers(noStoreHeaders);
  headers.append("Set-Cookie", clearAccountRecoveryCapability());
  return Response.json(
    { message: ACCOUNT_RECOVERY_GENERIC_ERROR },
    { status, headers },
  );
}

export async function POST(request: Request) {
  if (!validateSameOrigin(request, serverEnvironment.NEXT_PUBLIC_APP_URL)) {
    return rejected(403);
  }
  const parsed = accountRecoveryCapabilitySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return rejected(400);

  const authorized = await new AuthorizeAccountRecoveryRouteService().execute(
    parsed.data.kind,
    parsed.data.proof,
  );
  if (!authorized) return rejected(400);

  const headers = new Headers(noStoreHeaders);
  headers.append(
    "Set-Cookie",
    issueAccountRecoveryCapability(parsed.data.kind, parsed.data.proof),
  );
  return Response.json({ status: "authorized" }, { headers });
}
