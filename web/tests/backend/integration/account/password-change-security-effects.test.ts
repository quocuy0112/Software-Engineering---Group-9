import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { auth } from "@/backend/auth/cookies/config";
import { BetterAuthPasswordGateway } from "@/backend/auth/better-auth/better-auth-password-gateway";
import { prisma } from "@/backend/database/prisma";
import { ProtectedOutboxRecipient } from "@/backend/security/protected-recipient/protected-outbox-recipient";
import { ChangePasswordService } from "@/backend/services/account/change-password";
import { createCredentialFixture } from "../../../helpers/credential-fixture";
import { cleanupFixture } from "../auth/backup-code-fixture";

const origin = "http://localhost:3001";
const currentPassword = "Security effects current 2026!";
const newPassword = "Security effects changed 2026!";
let userId = "";
let email = "";
let firstCookie = "";
let secondCookie = "";
let initiatingSessionId = "";

function requestHeaders(cookie?: string) {
  const headers = new Headers({
    origin,
    "sec-fetch-site": "same-origin",
    "content-type": "application/json",
  });
  if (cookie) headers.set("cookie", cookie);
  return headers;
}

function responseCookie(response: Response) {
  return (
    response.headers
      .getSetCookie()
      .find((value) => value.startsWith("smarthire.session="))
      ?.split(";", 1)[0] ?? ""
  );
}

async function login(password = currentPassword) {
  return auth.handler(
    new Request(`${origin}/api/auth/sign-in/email`, {
      method: "POST",
      headers: requestHeaders(),
      body: JSON.stringify({ email, password }),
    }),
  );
}

beforeAll(async () => {
  const suffix = randomUUID();
  email = `password-security-${suffix}@example.test`;
  const user = await createCredentialFixture({
    name: "Password Security Effects",
    email,
    password: currentPassword,
  });
  userId = user.id;
  firstCookie = responseCookie(await login());
  secondCookie = responseCookie(await login());
  const current = await new BetterAuthPasswordGateway().authoritativeSession(
    requestHeaders(firstCookie),
  );
  if (!firstCookie || !secondCookie || !current) {
    throw new Error("PASSWORD_SECURITY_FIXTURE_FAILED");
  }
  initiatingSessionId = current.sessionId;
});

afterAll(async () => {
  if (!userId) return;
  await prisma.passwordChangeOperation.deleteMany({ where: { userId } });
  await prisma.passwordChangeAttemptWindow.deleteMany({ where: { userId } });
  await cleanupFixture(userId);
});

describe("password-change security effects", () => {
  it("retains only the initiating session and finalizes one protected mail/audit", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const now = new Date("2026-07-31T07:00:00.000Z");
    const result = await new ChangePasswordService().execute(
      {
        currentPassword,
        newPassword,
        newPasswordConfirmation: newPassword,
      },
      {
        userId,
        sessionId: initiatingSessionId,
        headers: requestHeaders(firstCookie),
        idempotencyKey: `password_change_${randomUUID().replaceAll("-", "_")}`,
        correlationId: `password-change-${randomUUID()}`,
        networkSource: { remoteAddress: "127.0.0.1" },
        now,
      },
    );
    expect(result).toEqual({
      status: "success",
      message: expect.any(String),
    });

    const sessions = await prisma.session.findMany({
      where: { userId },
      select: { id: true },
    });
    expect(sessions).toEqual([{ id: initiatingSessionId }]);
    const gateway = new BetterAuthPasswordGateway();
    await expect(
      gateway.passwordEffective(userId, currentPassword),
    ).resolves.toBe(false);
    await expect(gateway.passwordEffective(userId, newPassword)).resolves.toBe(
      true,
    );

    const operation = await prisma.passwordChangeOperation.findFirstOrThrow({
      where: { userId, status: "FINALIZED" },
    });
    const outbox = await prisma.emailOutbox.findMany({
      where: { id: operation.notificationOutboxId! },
    });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      kind: "PASSWORD_CHANGED",
      recipientPurpose: "password-change-notice.v1",
      payloadRef: {},
    });
    expect(
      new ProtectedOutboxRecipient().unseal(
        outbox[0]!.recipientCiphertext!,
        "password-change-notice.v1",
      ),
    ).toBe(email);
    expect(
      await prisma.auditEvent.count({
        where: {
          id: operation.finalAuditId!,
          actorUserId: userId,
          actorSessionId: initiatingSessionId,
          action: "password_change.succeeded",
          result: "SUCCESS",
        },
      }),
    ).toBe(1);

    const durable = JSON.stringify({ operation, outbox });
    expect(durable).not.toContain(currentPassword);
    expect(durable).not.toContain(newPassword);
    expect(durable).not.toContain(email);
    expect(JSON.stringify(log.mock.calls)).not.toContain(currentPassword);
    expect(JSON.stringify(error.mock.calls)).not.toContain(newPassword);
  });

  it("keeps the current cookie usable, rejects the other cookie, and changes login credentials", async () => {
    await expect(
      new BetterAuthPasswordGateway().authoritativeSession(
        requestHeaders(firstCookie),
      ),
    ).resolves.toMatchObject({ userId, sessionId: initiatingSessionId });
    await expect(
      new BetterAuthPasswordGateway().authoritativeSession(
        requestHeaders(secondCookie),
      ),
    ).resolves.toBeNull();
    expect((await login(currentPassword)).status).not.toBe(200);
    const newLogin = await auth.handler(
      new Request(`${origin}/api/auth/sign-in/email`, {
        method: "POST",
        headers: requestHeaders(),
        body: JSON.stringify({ email, password: newPassword }),
      }),
    );
    expect(newLogin.status).toBe(200);
  });
});
