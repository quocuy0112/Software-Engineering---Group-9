import { createHmac } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config as loadEnvironment } from "dotenv";
import { Pool } from "pg";
import { expect, test, type Page } from "@playwright/test";

loadEnvironment({ path: resolve(process.cwd(), ".env.local"), quiet: true });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const password = "full recovery original 2026!";
const replacementPassword = "full recovery replacement 2026!";
const mailDirectory = resolve(process.cwd(), ".local/mail");

function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.replace(/=+$/, "").toUpperCase().replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const character of clean) {
    const index = alphabet.indexOf(character);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      output.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(output);
}

function totp(secret: string, at = Date.now()) {
  const counter = Math.floor(at / 30_000);
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret))
    .update(buffer)
    .digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

async function waitForMailLink(
  email: string,
  before: Set<string>,
  pattern: RegExp,
) {
  let link = "";
  await expect
    .poll(async () => {
      for (const name of (await readdir(mailDirectory)).filter(
        (candidate) => !before.has(candidate),
      )) {
        const body = await readFile(resolve(mailDirectory, name), "utf8");
        if (body.includes(`To: ${email}`)) {
          link = body.match(pattern)?.[0] ?? link;
        }
      }
      return Boolean(link);
    }, { timeout: 20_000 })
    .toBe(true);
  return link;
}

async function registerVerifyAndEnroll(page: Page) {
  const email = `full-recovery-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  const before = new Set(await readdir(mailDirectory).catch(() => []));
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Full Recovery Candidate");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  const verificationLink = await waitForMailLink(
    email,
    before,
    /http:\/\/localhost:3001\/verify-email\?token=[A-Za-z0-9._~-]+/,
  );
  await page.goto(verificationLink);
  await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  const login = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/identity/login") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sign in" }).click();
  expect((await login).status()).toBe(200);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/profile/security");
  await expect(
    page.getByRole("heading", { name: "Set up two-factor authentication" }),
  ).toBeVisible();
  const enrollment = page.getByRole("region", {
    name: "Set up two-factor authentication",
  });
  await enrollment.getByLabel("Current password", { exact: true }).fill(password);
  await enrollment.getByRole("button", { name: "Continue" }).click();
  const secret = (await page.locator(".totp-manual code").innerText()).trim();
  await page.getByLabel("Six-digit code").fill(totp(secret));
  const verification = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/identity/two-factor/enrollment/verify") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Verify and enable" }).click();
  const backupCodes = ((await (await verification).json()) as {
    backupCodes: string[];
  }).backupCodes;
  expect(backupCodes).toHaveLength(10);
  return { email, secret, backupCode: backupCodes[0] };
}

async function requestRecovery(page: Page, email: string) {
  const before = new Set(await readdir(mailDirectory).catch(() => []));
  await page.goto("/account-recovery");
  await page.getByLabel("Email address").fill(email);
  const response = page.waitForResponse(
    (result) =>
      result.url().endsWith("/api/identity/account-recovery/request") &&
      result.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Send recovery instructions" }).click();
  expect((await response).status()).toBe(202);
  await expect(page.getByRole("status")).toContainText("eligible");
  return {
    before,
    confirmationLink: await waitForMailLink(
      email,
      before,
      /http:\/\/localhost:3001\/account-recovery\/confirm#proof=[A-Za-z0-9._~%-]+/,
    ),
  };
}

async function confirmAndReadPendingLinks(
  page: Page,
  email: string,
  confirmationLink: string,
  before: Set<string>,
) {
  await page.goto(confirmationLink);
  await expect.poll(() => page.url()).not.toContain("#proof=");
  await expect(page.getByRole("status")).toContainText("24-hour");
  await expect(page.getByText(/lower assurance/i)).toBeVisible();
  return {
    cancellationLink: await waitForMailLink(
      email,
      before,
      /http:\/\/localhost:3001\/account-recovery\/cancel#proof=[A-Za-z0-9._~%-]+/,
    ),
    completionLink: await waitForMailLink(
      email,
      before,
      /http:\/\/localhost:3001\/account-recovery\/complete#proof=[A-Za-z0-9._~%-]+/,
    ),
  };
}

async function shiftLatestHoldToElapsed(email: string) {
  const result = await pool.query(
    `UPDATE "FullAccountRecoveryOperation"
       SET "holdStartedAt" = NOW() - INTERVAL '24 hours 1 minute',
           "holdEndsAt" = NOW() - INTERVAL '1 minute',
           "cancellationProofExpiresAt" = NOW() - INTERVAL '1 minute',
           "completionProofExpiresAt" = NOW() + INTERVAL '7 days' - INTERVAL '1 minute',
           "updatedAt" = NOW()
     WHERE "id" = (
       SELECT operation."id"
       FROM "FullAccountRecoveryOperation" operation
       JOIN "user" account ON account."id" = operation."userId"
       WHERE account."normalizedEmail" = $1
         AND operation."status" = 'CONFIRMED_HOLD'
       ORDER BY operation."createdAt" DESC
       LIMIT 1
     )`,
    [email],
  );
  expect(result.rowCount).toBe(1);
}

test.afterAll(async () => {
  await pool.end();
});

test("full recovery is generic, cancellable once, held for 24 hours, and completes without a session", async ({
  page,
}) => {
  test.setTimeout(420_000);
  const { email, secret, backupCode } = await registerVerifyAndEnroll(page);

  await page.context().clearCookies();
  await page.goto("/account-recovery");
  await page
    .getByLabel("Email address")
    .fill(`unknown-${Date.now()}@example.test`);
  await page.getByRole("button", { name: "Send recovery instructions" }).click();
  await expect(page.getByRole("status")).toContainText("eligible");
  const unknownMessage = await page.getByRole("status").innerText();

  const first = await requestRecovery(page, email);
  expect(await page.getByRole("status").innerText()).toBe(unknownMessage);
  const firstLinks = await confirmAndReadPendingLinks(
    page,
    email,
    first.confirmationLink,
    first.before,
  );

  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("status")).toContainText("incorrect");
  expect(
    (await page.context().cookies()).some(
      (cookie) => cookie.name === "smarthire.session",
    ),
  ).toBe(false);

  await page.goto(firstLinks.cancellationLink);
  await expect.poll(() => page.url()).not.toContain("#proof=");
  await expect(page.getByRole("status")).toContainText("cancelled");
  const replay = await page.context().newPage();
  await replay.goto(firstLinks.cancellationLink);
  await expect(replay.getByRole("status")).toContainText(/invalid|used|expired/);
  await replay.close();

  const second = await requestRecovery(page, email);
  const secondLinks = await confirmAndReadPendingLinks(
    page,
    email,
    second.confirmationLink,
    second.before,
  );
  await page.goto(secondLinks.completionLink);
  await page
    .getByLabel("New password", { exact: true })
    .fill(replacementPassword);
  await page.getByLabel("Confirm new password").fill(replacementPassword);
  const preHold = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/identity/account-recovery/complete") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Complete recovery" }).click();
  expect((await preHold).status()).toBe(409);
  await expect(page.getByRole("status")).toContainText("still active");

  await shiftLatestHoldToElapsed(email);
  await page
    .getByLabel("New password", { exact: true })
    .fill(replacementPassword);
  await page.getByLabel("Confirm new password").fill(replacementPassword);
  const completion = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/identity/account-recovery/complete") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Complete recovery" }).click();
  const completionResponse = await completion;
  const completionBody = await completionResponse.json().catch(() => ({}));
  expect(
    completionResponse.status(),
    JSON.stringify(completionBody),
  ).toBe(200);
  await expect(page.getByRole("status")).toContainText("complete");
  await expect(
    page.getByText(
      "Re-enroll two-factor authentication after your next login.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(
    (await page.context().cookies()).some(
      (cookie) =>
        cookie.name === "smarthire.session" ||
        cookie.name === "smarthire.pre-auth",
    ),
  ).toBe(false);

  const state = await pool.query<{
    twoFactorEnabled: boolean;
    factorCount: string;
    completedCount: string;
  }>(
    `SELECT account."twoFactorEnabled",
            (SELECT COUNT(*)::text FROM "twoFactor" factor WHERE factor."userId" = account."id") AS "factorCount",
            (SELECT COUNT(*)::text FROM "FullAccountRecoveryOperation" operation
              WHERE operation."userId" = account."id" AND operation."status" = 'COMPLETED') AS "completedCount"
       FROM "user" account WHERE account."normalizedEmail" = $1`,
    [email],
  );
  expect(state.rows[0]).toMatchObject({
    twoFactorEnabled: false,
    factorCount: "0",
    completedCount: "1",
  });

  await page.goto("/two-factor");
  await page.getByRole("button", { name: "Backup code" }).click();
  await page.getByLabel("Backup code").fill(backupCode);
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByRole("status")).toContainText("could not be completed");
  await page.getByRole("button", { name: "Authenticator code" }).click();
  await page.getByLabel("Authentication code").fill(totp(secret));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByRole("status")).toContainText("could not be completed");

  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(replacementPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(page.url()).not.toContain("two-factor");
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
