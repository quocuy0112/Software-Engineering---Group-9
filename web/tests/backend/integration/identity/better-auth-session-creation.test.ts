import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/backend/database/prisma";
import { requireSession } from "@/backend/auth/session/require-session";
import { LoginWithPasswordService } from "@/backend/services/identity/login-with-password";
import { PrismaRegistrationRepository } from "@/backend/repositories/identity/prisma-registration-repository";
import { BetterAuthGateway } from "@/backend/auth/better-auth/better-auth-gateway";
import { TokenProtector } from "@/backend/security/security-token/security-tokens";
import { BetterAuthSessionGateway } from "@/backend/auth/better-auth/better-auth-session-gateway";
import { RevokeSessionService } from "@/backend/services/session/revoke-session";
import { ListSessionsService } from "@/backend/services/session/list-sessions";
async function active() {
  const id = randomUUID(),
    email = `sole-${id}@example.test`,
    password = "correct horse 2026",
    p = new TokenProtector();
  const made = await new PrismaRegistrationRepository().create({
    name: "Sole",
    email,
    normalizedEmail: email,
    credentialPassword:
      await new BetterAuthGateway().preparePasswordForCredential(password),
    tokenDigest: p.digest(p.generate()),
    protectedToken: p.seal(p.generate()),
    expiresAt: new Date(Date.now() + 86400000),
    correlationId: id,
  });
  await prisma.userAccount.update({
    where: { id: made.userId },
    data: { state: "ACTIVE", emailVerified: true },
  });
  return { email, password, userId: made.userId };
}
describe("sole Better Auth session creation", () => {
  it("creates one opaque database session and no second auth cookie", async () => {
    const f = await active(),
      headers = new Headers({
        origin: "http://localhost:3001",
        "sec-fetch-site": "same-origin",
      });
    const response = await new LoginWithPasswordService().execute(f, {
      headers,
      subject: randomUUID(),
    });
    expect(
      response.headers.getSetCookie().filter((v) => v.includes("session=")),
    ).toHaveLength(1);
    expect(await prisma.session.count({ where: { userId: f.userId } })).toBe(1);
  });
  it("does not treat an AuthenticationChallenge as authorization", async () => {
    const f = await active();
    await prisma.authenticationChallenge.create({
      data: {
        id: randomUUID(),
        userId: f.userId,
        handleDigest: randomUUID(),
        purpose: "PASSWORD_LOGIN_2FA",
        expiresAt: new Date(Date.now() + 300000),
      },
    });
    expect(await requireSession(new Headers())).toBeNull();
    expect(await prisma.session.count({ where: { userId: f.userId } })).toBe(0);
  });
});
describe("owned session operations", () => {
  it("lists sanitized data, revokes one idempotently, and rejects the old cookie", async () => {
    const f = await active(),
      base = new Headers({
        origin: "http://localhost:3001",
        "sec-fetch-site": "same-origin",
        "user-agent": "desktop",
      }),
      service = new LoginWithPasswordService();
    const first = await service.execute(f, {
        headers: base,
        subject: randomUUID(),
      }),
      second = await service.execute(f, {
        headers: base,
        subject: randomUUID(),
      });
    const cookie = (response: Response) =>
      response.headers
        .getSetCookie()
        .find((value) => value.startsWith("smarthire.session="))!
        .split(";", 1)[0];
    const firstHeaders = new Headers(base);
    firstHeaders.set("cookie", cookie(first));
    const secondHeaders = new Headers(base);
    secondHeaders.set("cookie", cookie(second));
    const gateway = new BetterAuthSessionGateway(),
      secondCurrent = await gateway.current(secondHeaders),
      firstCurrent = await gateway.current(firstHeaders);
    expect(secondCurrent).not.toBeNull();
    const listed = await new ListSessionsService().execute(
      f.userId,
      firstCurrent!.session.id,
    );
    expect(JSON.stringify(listed)).not.toMatch(/token|cookie/i);
    await new RevokeSessionService().execute(
      secondCurrent!.session.id,
      f.userId,
      firstHeaders,
    );
    await new RevokeSessionService().execute(
      secondCurrent!.session.id,
      f.userId,
      firstHeaders,
    );
    expect(await requireSession(secondHeaders)).toBeNull();
    expect(await requireSession(firstHeaders)).not.toBeNull();
  });
});
