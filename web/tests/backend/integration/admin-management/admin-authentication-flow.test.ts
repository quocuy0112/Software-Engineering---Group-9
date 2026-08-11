import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { auth } from "@/backend/auth/cookies/config";
import { BetterAuthGateway } from "@/backend/auth/better-auth/better-auth-gateway";
import { configuredOrigins } from "@/backend/admin/origins";
import { prisma } from "@/backend/database/prisma";
import { POST as login } from "@/app/api/admin/auth/login/route";
import { POST as completeFactor } from "@/app/api/admin/auth/two-factor/route";
import {
  cleanupFixture,
  enabledFixture,
  fixturePassword,
} from "../auth/backup-code-fixture";

const createdUsers: string[] = [];

function adminHeaders(cookie?: string) {
  const origin = configuredOrigins().admin;
  const headers = new Headers({
    origin,
    host: new URL(origin).host,
    "sec-fetch-site": "same-origin",
    "content-type": "application/json",
    "x-forwarded-for": randomUUID(),
  });
  if (cookie) headers.set("cookie", cookie);
  return headers;
}

function responseCookie(response: Response, name: string) {
  return (
    response.headers
      .getSetCookie()
      .find((value) => value.startsWith(`${name}=`))
      ?.split(";", 1)[0] ?? null
  );
}

afterEach(async () => {
  for (const userId of createdUsers) {
    await prisma.platformAdministratorGrant.deleteMany({ where: { userId } });
    await cleanupFixture(userId);
  }
  createdUsers.length = 0;
});

describe("administrator initial two-factor authentication", () => {
  it("resolves the signed session cookie and designates the verified session", async () => {
    const fixture = await enabledFixture();
    createdUsers.push(fixture.userId);
    const grant = await prisma.platformAdministratorGrant.create({
      data: { userId: fixture.userId },
    });
    const origin = configuredOrigins().admin;
    const loginResponse = await login(
      new Request(`${origin}/api/admin/auth/login`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({
          email: fixture.email,
          password: fixturePassword,
        }),
      }),
    );
    expect(loginResponse.status, await loginResponse.clone().text()).toBe(200);
    expect(
      loginResponse.headers
        .getSetCookie()
        .find((value) => value.startsWith("smarthire.pre-auth=")),
    ).toContain("Path=/api/admin/auth/two-factor");
    const preAuth = responseCookie(loginResponse, "smarthire.pre-auth");
    expect(preAuth).not.toBeNull();

    const { code } = await auth.api.generateTOTP({
      body: { secret: fixture.secret },
    });
    const factorResponse = await completeFactor(
      new Request(`${origin}/api/admin/auth/two-factor`, {
        method: "POST",
        headers: adminHeaders(preAuth!),
        body: JSON.stringify({ code, factor: "totp" }),
      }),
    );
    expect(factorResponse.status, await factorResponse.clone().text()).toBe(
      200,
    );
    const sessionCookie = responseCookie(factorResponse, "smarthire.session");
    expect(
      sessionCookie,
      JSON.stringify(
        factorResponse.headers
          .getSetCookie()
          .map((value) => value.slice(0, value.indexOf("="))),
      ),
    ).not.toBeNull();
    const sessionHeaders = new Headers({ cookie: sessionCookie! });
    const session = await new BetterAuthGateway().getSession(sessionHeaders);
    expect(session?.userId).toBe(fixture.userId);
    expect(
      await prisma.administratorSessionPolicy.findUnique({
        where: { grantId: grant.id },
        select: { designatedSessionId: true },
      }),
    ).toEqual({ designatedSessionId: session?.sessionId });
  });
});
