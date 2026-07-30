import {
  accountRecoveryCapabilitySchema,
  ACCOUNT_RECOVERY_GENERIC_ERROR,
} from "@/shared/contracts/identity/password-recovery";
import { serverEnvironment } from "@/backend/env/runtime";
import {
  clearAccountRecoveryCapability,
  issueAccountRecoveryCapability,
} from "@/backend/security/account-recovery-capability";
import { validateSameOrigin } from "@/backend/security/csrf/csrf";
import { noStoreHeaders } from "@/backend/security/response-headers";
import { AuthorizeAccountRecoveryRouteService } from "@/backend/services/profile/authorize-account-recovery-route";

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
