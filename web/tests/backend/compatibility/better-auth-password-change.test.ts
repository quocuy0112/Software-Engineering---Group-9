import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auth } from "@/backend/auth/cookies/config";
import { BetterAuthPasswordGateway } from "@/backend/auth/better-auth/better-auth-password-gateway";
import { prisma } from "@/backend/database/prisma";
import { createCredentialFixture } from "../../helpers/credential-fixture";
import { cleanupFixture } from "../integration/auth/backup-code-fixture";

const origin = "http://localhost:3001";
const currentPassword = "Gateway current password 2026!";
const unicodePassword = `${"🔐".repeat(100)}${"x".repeat(28)}`;
let userId = "";
let email = "";
let firstCookie = "";
let secondCookie = "";

function headers(cookie?: string) {
  const value = new Headers({
    origin,
    "sec-fetch-site": "same-origin",
    "content-type": "application/json",
  });
  if (cookie) value.set("cookie", cookie);
  return value;
}

function sessionCookie(response: Response) {
  return (
    response.headers
      .getSetCookie()
      .find((value) => value.startsWith("smarthire.session="))
      ?.split(";", 1)[0] ?? ""
  );
}

async function signIn() {
  return auth.handler(
    new Request(`${origin}/api/auth/sign-in/email`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ email, password: currentPassword }),
    }),
  );
}

beforeAll(async () => {
  const suffix = randomUUID();
  email = `password-gateway-${suffix}@example.test`;
  const user = await createCredentialFixture({
    name: "Password Gateway",
    email,
    password: currentPassword,
  });
  userId = user.id;
  firstCookie = sessionCookie(await signIn());
  secondCookie = sessionCookie(await signIn());
  if (!firstCookie || !secondCookie) throw new Error("SESSION_FIXTURE_FAILED");
});

afterAll(async () => {
  if (userId) await cleanupFixture(userId);
});

describe("Better Auth 1.6.25 password-change compatibility", () => {
  it("classifies without exposing a hash and performs a Unicode-safe internal update", async () => {
    expect([...unicodePassword]).toHaveLength(128);
    expect(unicodePassword.length).toBeGreaterThan(128);
    const gateway = new BetterAuthPasswordGateway();
    await expect(
      gateway.classify(userId, currentPassword, unicodePassword),
    ).resolves.toEqual({
      currentPasswordValid: true,
      newPasswordMatchesCurrent: false,
    });
    await expect(
      gateway.classify(userId, "wrong current", currentPassword),
    ).resolves.toEqual({
      currentPasswordValid: false,
      newPasswordMatchesCurrent: true,
    });
    await expect(gateway.updatePassword(userId, unicodePassword)).resolves.toBe(
      true,
    );
    await expect(
      gateway.passwordEffective(userId, unicodePassword),
    ).resolves.toBe(true);
    await expect(gateway.updatePassword(userId, unicodePassword)).resolves.toBe(
      false,
    );
  });

  it("derives the initiating session from the cookie and natively revokes only others", async () => {
    const gateway = new BetterAuthPasswordGateway();
    const current = await gateway.authoritativeSession(headers(firstCookie));
    expect(current).toMatchObject({ userId, sessionId: expect.any(String) });
    await expect(
      gateway.assertAuthoritativeSession(
        headers(firstCookie),
        userId,
        "client-selected-session",
      ),
    ).rejects.toThrow("PASSWORD_CHANGE_SESSION_MISMATCH");
    await gateway.revokeOtherSessions(
      headers(firstCookie),
      userId,
      current!.sessionId,
    );
    const remaining = await prisma.session.findMany({
      where: { userId },
      select: { id: true, token: true },
    });
    expect(remaining).toEqual([
      expect.objectContaining({ id: current!.sessionId }),
    ]);
    expect(decodeURIComponent(firstCookie.split("=")[1] ?? "")).toMatch(
      new RegExp(`^${remaining[0]?.token}\\.`),
    );
    expect(secondCookie).not.toBe(firstCookie);
  });
});
