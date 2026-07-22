import "server-only";
import { auth } from "@/server/auth/config";
import { serverEnvironment } from "@/lib/env/runtime";
export class BetterAuthSessionGateway {
  private request(path: string, body: unknown, headers: Headers) {
    const forwarded = new Headers(headers);
    forwarded.set("content-type", "application/json");
    forwarded.set(
      "origin",
      new URL(serverEnvironment.NEXT_PUBLIC_APP_URL).origin,
    );
    return auth.handler(
      new Request(
        new URL(`/api/auth${path}`, serverEnvironment.BETTER_AUTH_URL),
        { method: "POST", headers: forwarded, body: JSON.stringify(body) },
      ),
    );
  }
  signIn(email: string, password: string, headers: Headers) {
    return this.request(
      "/sign-in/email",
      { email, password, rememberMe: true },
      headers,
    );
  }
  verifyTotp(code: string, headers: Headers) {
    return this.request(
      "/two-factor/verify-totp",
      { code, trustDevice: false },
      headers,
    );
  }
  signOut(headers: Headers) {
    return this.request("/sign-out", {}, headers);
  }
  async current(headers: Headers) {
    return auth.api.getSession({ headers }).catch(() => null);
  }
  async list(headers: Headers) {
    return auth.api.listSessions({ headers });
  }
  async revoke(headers: Headers, token: string) {
    await auth.api.revokeSession({ headers, body: { token } });
  }
}
