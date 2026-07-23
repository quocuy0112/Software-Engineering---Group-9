import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { auth } from "@/server/auth/config";
import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import { prisma } from "@/lib/db/prisma";
import { serverEnvironment } from "@/lib/env/runtime";

const runId = randomUUID();
const email = `totp-store-${runId}@example.test`;
const password = "Storage Protection Passphrase 2026!";
const baseURL = "http://localhost:3001/api/auth";

async function request(
  path: string,
  options: { body?: unknown; cookie?: string } = {},
) {
  const headers = new Headers({ origin: "http://localhost:3001" });
  if (options.body !== undefined)
    headers.set("content-type", "application/json");
  if (options.cookie) headers.set("cookie", options.cookie);
  return auth.handler(
    new Request(`${baseURL}${path}`, {
      method: options.body === undefined ? "GET" : "POST",
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    }),
  );
}

function responseCookie(response: Response, name: string): string | null {
  for (const value of response.headers.getSetCookie()) {
    const pair = value.split(";", 1)[0];
    if (pair.startsWith(`${name}=`)) return pair;
  }
  return null;
}

function signIn() {
  return request("/sign-in/email", { body: { email, password } });
}

async function enroll() {
  const login = await signIn();
  const cookie = responseCookie(login, "smarthire.session")!;
  const enable = await request("/two-factor/enable", {
    cookie,
    body: { password },
  });
  expect(enable.status, await enable.clone().text()).toBe(200);
  const payload = (await enable.json()) as {
    totpURI: string;
    backupCodes: string[];
  };
  return { cookie, ...payload };
}

afterAll(async () => {
  const user = await prisma.userAccount.findUnique({
    where: { normalizedEmail: email },
  });
  if (user) {
    await prisma.twoFactor.deleteMany({ where: { userId: user.id } });
    await prisma.candidateIdentity.deleteMany({ where: { userId: user.id } });
    await prisma.userAccount.delete({ where: { id: user.id } });
  }
  await prisma.$disconnect();
});

describe.sequential(
  "Better Auth 1.6.11 TOTP storage protection (PostgreSQL)",
  () => {
    it("bootstraps an ACTIVE account", async () => {
      const response = await request("/sign-up/email", {
        body: { name: "Storage User", email, password },
      });
      expect(response.status, await response.clone().text()).toBe(200);
      await prisma.userAccount.update({
        where: { normalizedEmail: email },
        data: { state: "ACTIVE" },
      });
    });

    it("persists the TOTP secret encrypted at rest, not in plaintext", async () => {
      const { totpURI } = await enroll();
      const plaintextSecret = new URL(totpURI).searchParams.get("secret")!;
      const stored = await prisma.twoFactor.findFirstOrThrow({
        where: { user: { normalizedEmail: email } },
      });

      expect(stored.secret).not.toContain(plaintextSecret);
      expect(stored.secret).not.toBe(plaintextSecret);
      // Envelope decrypts only with the server secret and yields the base32 seed, never the raw otpauth secret param.
      const decrypted = await symmetricDecrypt({
        key: serverEnvironment.BETTER_AUTH_SECRET,
        data: stored.secret,
      });
      expect(decrypted).toBeTruthy();
      expect(decrypted).not.toBe(plaintextSecret);
    });

    it("persists backup codes encrypted at rest, never as readable code text", async () => {
      const { backupCodes } = await enroll();
      expect(backupCodes).toHaveLength(10);
      const stored = await prisma.twoFactor.findFirstOrThrow({
        where: { user: { normalizedEmail: email } },
      });
      for (const code of backupCodes) {
        expect(stored.backupCodes).not.toContain(code);
      }
      const decrypted = await symmetricDecrypt({
        key: serverEnvironment.BETTER_AUTH_SECRET,
        data: stored.backupCodes,
      });
      const parsed = JSON.parse(decrypted) as string[];
      expect(parsed).toHaveLength(10);
      expect(parsed).toEqual(expect.arrayContaining(backupCodes));
    });

    it("fails safely when the stored ciphertext is tampered with", async () => {
      await enroll();
      const stored = await prisma.twoFactor.findFirstOrThrow({
        where: { user: { normalizedEmail: email } },
      });
      const tampered = `${stored.secret.slice(0, -2)}${stored.secret.endsWith("AA") ? "BB" : "AA"}`;
      await expect(
        symmetricDecrypt({
          key: serverEnvironment.BETTER_AUTH_SECRET,
          data: tampered,
        }),
      ).rejects.toBeTruthy();
      // A ciphertext produced under a different key must not decrypt with the server key.
      const foreign = await symmetricEncrypt({
        key: "a-different-secret-key-2026",
        data: "spoofed",
      });
      await expect(
        symmetricDecrypt({
          key: serverEnvironment.BETTER_AUTH_SECRET,
          data: foreign,
        }),
      ).rejects.toBeTruthy();
    });

    it("rotates persisted material, replacing prior data on re-enrollment", async () => {
      const before = await prisma.twoFactor.findFirstOrThrow({
        where: { user: { normalizedEmail: email } },
      });
      const { totpURI } = await enroll();
      const rows = await prisma.twoFactor.findMany({
        where: { user: { normalizedEmail: email } },
      });
      // Better Auth deletes prior rows for the user before inserting the new secret: exactly one row remains.
      expect(rows).toHaveLength(1);
      const after = rows[0];
      expect(after.secret).not.toBe(before.secret);
      const decrypted = await symmetricDecrypt({
        key: serverEnvironment.BETTER_AUTH_SECRET,
        data: after.secret,
      });
      const rotatedSecret = new URL(totpURI).searchParams.get("secret")!;
      expect(decrypted).not.toBe(rotatedSecret);
      expect(after.backupCodes).not.toBe(before.backupCodes);
    });

    it("remains the exclusive persistence owner: no SmartHire secret table exists", async () => {
      const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name ILIKE '%totp%'
    `;
      expect(tables).toHaveLength(0);
      const twoFactorTables = await prisma.$queryRaw<
        Array<{ table_name: string }>
      >`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'twoFactor'
    `;
      expect(twoFactorTables).toHaveLength(1);
    });
  },
);
