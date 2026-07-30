import { randomUUID } from "node:crypto";
import { auth } from "@/backend/auth/cookies/config";
import { prisma } from "@/backend/database/prisma";
import { symmetricDecrypt } from "better-auth/crypto";
import { serverEnvironment } from "@/backend/env/runtime";
import { createCredentialFixture } from "../../../helpers/credential-fixture";

export const fixturePassword = "Backup Code Fixture 2026!";
const origin = "http://localhost:3001";
export function requestHeaders(cookie?: string) {
  const h = new Headers({
    origin,
    "sec-fetch-site": "same-origin",
    "content-type": "application/json",
  });
  if (cookie) h.set("cookie", cookie);
  return h;
}
export function cookie(response: Response, name: string) {
  return (
    response.headers
      .getSetCookie()
      .find((v) => v.startsWith(`${name}=`))
      ?.split(";", 1)[0] ?? null
  );
}
export async function authRequest(
  path: string,
  body: unknown,
  cookieValue?: string,
) {
  return auth.handler(
    new Request(`${origin}/api/auth${path}`, {
      method: "POST",
      headers: requestHeaders(cookieValue),
      body: JSON.stringify(body),
    }),
  );
}
export async function enabledFixture() {
  const id = randomUUID(),
    email = `backup-${id}@example.test`;
  const user = await createCredentialFixture({
    name: "Backup User",
    email,
    password: fixturePassword,
  });
  const login = await authRequest("/sign-in/email", {
    email,
    password: fixturePassword,
  });
  const session = cookie(login, "smarthire.session");
  if (!session) throw new Error("fixture session failed");
  const enable = await authRequest(
    "/two-factor/enable",
    { password: fixturePassword },
    session,
  );
  const setup = (await enable.json()) as {
    totpURI: string;
    backupCodes: string[];
  };
  const stored = await prisma.twoFactor.findUniqueOrThrow({
    where: { userId: user.id },
  });
  const secret = await symmetricDecrypt({
    key: serverEnvironment.BETTER_AUTH_SECRET,
    data: stored.secret,
  });
  const generated = await auth.api.generateTOTP({ body: { secret } });
  const verified = await authRequest(
    "/two-factor/verify-totp",
    { code: generated.code },
    session,
  );
  const activeSession = cookie(verified, "smarthire.session") ?? session;
  return {
    userId: user.id,
    email,
    session: activeSession,
    backupCodes: setup.backupCodes,
    secret,
  };
}
export async function preAuth(email: string) {
  const login = await authRequest("/sign-in/email", {
    email,
    password: fixturePassword,
  });
  const value = cookie(login, "smarthire.pre-auth");
  if (!value) throw new Error("fixture pre-auth failed");
  return value;
}
export async function cleanupFixture(userId: string) {
  await prisma.authenticationChallenge.deleteMany({ where: { userId } });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.twoFactor.deleteMany({ where: { userId } });
  await prisma.passwordResetOperation.deleteMany({ where: { userId } });
  await prisma.fullAccountRecoveryOperation.deleteMany({ where: { userId } });
  await prisma.emailOutbox.deleteMany({ where: { userId } });
  await prisma.authProviderAccount.deleteMany({ where: { userId } });
  await prisma.candidateIdentity.deleteMany({ where: { userId } });
  await prisma.securityToken.deleteMany({ where: { userId } });
  await prisma.userAccount.deleteMany({ where: { id: userId } });
}
