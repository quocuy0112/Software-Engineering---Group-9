import { afterEach, describe, expect, it } from "vitest";
import {
  authRequest,
  cleanupFixture,
  enabledFixture,
  fixturePassword,
  requestHeaders,
} from "../auth/backup-code-fixture";
import { LoginWithPasswordService } from "@/server/services/identity/login-with-password";
import { BetterAuthSessionGateway } from "@/server/auth/identity/better-auth-session-gateway";
import { POST as complete } from "@/app/api/identity/two-factor/complete/route";
let userId: string | undefined;
afterEach(async () => {
  if (userId) await cleanupFixture(userId);
  userId = undefined;
});
describe("SmartHire backup-code challenge completion", () => {
  it("creates the sole Better Auth session and clears pre-auth state", async () => {
    const f = await enabledFixture();
    userId = f.userId;
    await (
      await import("@/lib/db/prisma")
    ).prisma.session.deleteMany({ where: { userId: f.userId } });
    const provider = await authRequest("/sign-in/email", {
      email: f.email,
      password: fixturePassword,
    });
    const login = await new LoginWithPasswordService({
      signIn: async () => provider,
    } as unknown as BetterAuthSessionGateway).execute(
      { email: f.email, password: fixturePassword, returnTo: "/" },
      { headers: requestHeaders(), subject: `backup-e2e-${f.userId}` },
    );
    expect(login.status).toBe(200);
    expect(
      await (
        await import("@/lib/db/prisma")
      ).prisma.session.count({ where: { userId: f.userId } }),
    ).toBe(0);
    const pre = login.headers
      .getSetCookie()
      .find((v) => v.startsWith("smarthire.pre-auth="))!
      .split(";", 1)[0];
    const h = requestHeaders(pre);
    const result = await complete(
      new Request("http://localhost:3000/api/identity/two-factor/complete", {
        method: "POST",
        headers: h,
        body: JSON.stringify({ factor: "backup-code", code: f.backupCodes[0] }),
      }),
    );
    expect(result.status, await result.clone().text()).toBe(200);
    expect(
      result.headers
        .getSetCookie()
        .some((v) => v.startsWith("smarthire.session=")),
    ).toBe(true);
    expect(
      result.headers
        .getSetCookie()
        .some((v) => v.startsWith("smarthire.pre-auth=;")),
    ).toBe(true);
    expect(
      await (
        await import("@/lib/db/prisma")
      ).prisma.session.count({ where: { userId: f.userId } }),
    ).toBe(1);
  });
});
