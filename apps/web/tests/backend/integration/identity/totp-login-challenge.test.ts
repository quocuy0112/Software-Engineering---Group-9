import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { symmetricDecrypt } from "better-auth/crypto";
import { auth } from "@/backend/auth/cookies/config";
import { prisma } from "@/backend/database/prisma";
import { serverEnvironment } from "@/backend/env/runtime";
import { TokenProtector } from "@/backend/security/security-token/security-tokens";
import { BetterAuthGateway } from "@/backend/auth/better-auth/better-auth-gateway";
import { BetterAuthSessionGateway } from "@/backend/auth/better-auth/better-auth-session-gateway";
import { PrismaRegistrationRepository } from "@/backend/repositories/identity/prisma-registration-repository";
import { LoginWithPasswordService } from "@/backend/services/identity/login-with-password";
import { POST as complete } from "@/app/api/identity/two-factor/complete/route";
const password = "Challenge Password 2026!",
  emails: string[] = [];
const base = () =>
  new Headers({
    origin: "http://localhost:3001",
    "sec-fetch-site": "same-origin",
    "content-type": "application/json",
    "x-forwarded-for": randomUUID(),
  });
async function fixture(
  state: "ACTIVE" | "PENDING_VERIFICATION" | "SUSPENDED" | "DELETED" = "ACTIVE",
) {
  const correlationId = randomUUID(),
    email = `challenge-${correlationId}@example.test`,
    p = new TokenProtector();
  emails.push(email);
  await new PrismaRegistrationRepository().create({
    name: "Challenge",
    email,
    normalizedEmail: email,
    credentialPassword:
      await new BetterAuthGateway().preparePasswordForCredential(password),
    tokenDigest: p.digest(p.generate()),
    protectedToken: p.seal(p.generate()),
    expiresAt: new Date(Date.now() + 86400000),
    correlationId,
  });
  const user = await prisma.userAccount.update({
    where: { normalizedEmail: email },
    data: {
      state,
      emailVerified: state === "ACTIVE",
      deletedAt: state === "DELETED" ? new Date() : null,
    },
  });
  return { id: user.id, email };
}
async function enable(id: string, email: string) {
  const sign = await new BetterAuthSessionGateway().signIn(
      email,
      password,
      base(),
    ),
    session = sign.headers
      .getSetCookie()
      .find((v) => v.startsWith("smarthire.session="))!
      .split(";", 1)[0],
    h = base();
  h.set("cookie", session);
  await auth.api.enableTwoFactor({ headers: h, body: { password } });
  const stored = await prisma.twoFactor.findUniqueOrThrow({
      where: { userId: id },
    }),
    secret = await symmetricDecrypt({
      key: serverEnvironment.BETTER_AUTH_SECRET,
      data: stored.secret,
    }),
    { code } = await auth.api.generateTOTP({ body: { secret } });
  await auth.api.verifyTOTP({ headers: h, body: { code } });
  await prisma.session.deleteMany({ where: { userId: id } });
  return secret;
}
afterEach(async () => {
  for (const email of emails) {
    const u = await prisma.userAccount.findUnique({
      where: { normalizedEmail: email },
    });
    if (u) {
      await prisma.authenticationChallenge.deleteMany({
        where: { userId: u.id },
      });
      await prisma.session.deleteMany({ where: { userId: u.id } });
      await prisma.twoFactor.deleteMany({ where: { userId: u.id } });
      await prisma.authProviderAccount.deleteMany({ where: { userId: u.id } });
      await prisma.candidateIdentity.deleteMany({ where: { userId: u.id } });
      await prisma.securityToken.deleteMany({ where: { userId: u.id } });
      await prisma.userAccount.delete({ where: { id: u.id } });
    }
  }
  emails.length = 0;
});
describe("TOTP login challenge", () => {
  it("creates no session before TOTP and exactly one Better Auth session after success", async () => {
    const f = await fixture(),
      secret = await enable(f.id, f.email),
      raw = await new BetterAuthSessionGateway().signIn(
        f.email,
        password,
        base(),
      ),
      login = await new LoginWithPasswordService({
        signIn: async () => raw,
      } as unknown as BetterAuthSessionGateway).execute(
        { email: f.email, password, returnTo: "/settings/sessions" },
        { headers: base(), subject: randomUUID() },
      );
    expect(
      raw.status,
      JSON.stringify(
        raw.headers.getSetCookie().map((v) => v.slice(0, v.indexOf("="))),
      ),
    ).toBe(200);
    expect(
      raw.headers.getSetCookie().map((v) => v.slice(0, v.indexOf("="))),
    ).toContain("smarthire.pre-auth");
    expect(
      await prisma.userAccount.findUnique({
        where: { id: f.id },
        select: { state: true, twoFactorEnabled: true },
      }),
    ).toEqual({ state: "ACTIVE", twoFactorEnabled: true });
    expect(
      login.status,
      `${await login.clone().text()} ${JSON.stringify(login.headers.getSetCookie())}`,
    ).toBe(200);
    expect(await prisma.session.count({ where: { userId: f.id } })).toBe(0);
    expect(
      login.headers
        .getSetCookie()
        .some((v) => v.startsWith("smarthire.session=")),
    ).toBe(false);
    const pre = login.headers
        .getSetCookie()
        .find((v) => v.startsWith("smarthire.pre-auth="))!
        .split(";", 1)[0],
      { code } = await auth.api.generateTOTP({ body: { secret } }),
      h = base();
    h.set("cookie", pre);
    const response = await complete(
      new Request("http://localhost:3001/api/identity/two-factor/complete", {
        method: "POST",
        headers: h,
        body: JSON.stringify({ factor: "totp", code }),
      }),
    );
    expect(response.status, await response.clone().text()).toBe(200);
    expect(
      response.headers
        .getSetCookie()
        .some((v) => v.startsWith("smarthire.session=")),
    ).toBe(true);
    expect(
      response.headers
        .getSetCookie()
        .some((v) => v.startsWith("smarthire.pre-auth=;")),
    ).toBe(true);
    expect(await prisma.session.count({ where: { userId: f.id } })).toBe(1);
  });
  it("invalid TOTP creates no session and inactive states create no challenge", async () => {
    const f = await fixture(),
      awaited = await enable(f.id, f.email),
      raw = await new BetterAuthSessionGateway().signIn(
        f.email,
        password,
        base(),
      ),
      login = await new LoginWithPasswordService({
        signIn: async () => raw,
      } as unknown as BetterAuthSessionGateway).execute(
        { email: f.email, password, returnTo: "/" },
        { headers: base(), subject: randomUUID() },
      ),
      pre = login.headers
        .getSetCookie()
        .find((v) => v.startsWith("smarthire.pre-auth="))!
        .split(";", 1)[0],
      h = base();
    void awaited;
    h.set("cookie", pre);
    expect(
      (
        await complete(
          new Request(
            "http://localhost:3001/api/identity/two-factor/complete",
            {
              method: "POST",
              headers: h,
              body: JSON.stringify({ factor: "totp", code: "000000" }),
            },
          ),
        )
      ).status,
    ).toBe(401);
    expect(await prisma.session.count({ where: { userId: f.id } })).toBe(0);
    for (const state of [
      "PENDING_VERIFICATION",
      "SUSPENDED",
      "DELETED",
    ] as const) {
      const x = await fixture(state);
      const r = await new LoginWithPasswordService().execute(
        { email: x.email, password, returnTo: "/" },
        { headers: base(), subject: randomUUID() },
      );
      expect(r.status).toBe(401);
      expect(
        await prisma.authenticationChallenge.count({ where: { userId: x.id } }),
      ).toBe(0);
    }
  });
});
