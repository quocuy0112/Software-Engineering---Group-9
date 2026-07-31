import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { config as loadEnvironment } from "dotenv";
import { Client } from "pg";

loadEnvironment({ path: resolve(process.cwd(), ".env.local"), quiet: true });

test.describe.configure({ mode: "serial" });

const currentPassword = "Password journey current 2026!";
const newPassword = "Password journey changed 2026!";
const mailDirectory = resolve(process.cwd(), ".local/mail");

async function waitForMail(before: Set<string>, recipient: string) {
  let body = "";
  await expect
    .poll(
      async () => {
        for (const name of (await readdir(mailDirectory)).filter(
          (candidate) => !before.has(candidate),
        )) {
          const candidate = await readFile(
            resolve(mailDirectory, name),
            "utf8",
          );
          if (
            candidate.includes(`To: ${recipient}`) &&
            /password was changed/i.test(candidate)
          ) {
            body = candidate;
          }
        }
        return Boolean(body);
      },
      { timeout: 60_000 },
    )
    .toBe(true);
  return body;
}

async function registerVerifyAndLogin(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = `password-change-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}@example.test`;
  const before = new Set(await readdir(mailDirectory).catch(() => []));
  await page.goto("/register");
  await page
    .getByLabel("Full name", { exact: true })
    .fill("Password Candidate");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(currentPassword);
  await page.getByLabel("Confirm password").fill(currentPassword);
  await page.getByRole("button", { name: "Create account" }).click();
  let verification = "";
  await expect
    .poll(
      async () => {
        for (const name of (await readdir(mailDirectory)).filter(
          (candidate) => !before.has(candidate),
        )) {
          const candidate = await readFile(
            resolve(mailDirectory, name),
            "utf8",
          );
          if (
            candidate.includes(`To: ${email}`) &&
            candidate.includes("/verify-email?token=")
          ) {
            verification = candidate;
          }
        }
        return Boolean(verification);
      },
      { timeout: 60_000 },
    )
    .toBe(true);
  const link =
    verification.match(
      /http:\/\/localhost:3001\/verify-email\?token=[A-Za-z0-9._~-]+/,
    )?.[0] ?? "";
  expect(link).not.toBe("");
  await page.goto(link);
  await page.getByRole("link", { name: "Continue to login" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(currentPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return { context, page, email };
}

async function signIn(
  browser: Browser,
  email: string,
  password: string,
  shouldSucceed: boolean,
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  if (shouldSucceed) {
    await expect(page).toHaveURL(/\/dashboard$/);
  } else {
    await expect(page).not.toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("alert")).toBeVisible();
  }
  await context.close();
}

async function expireAttemptLock(email: string) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL_REQUIRED");
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(
      `UPDATE "PasswordChangeAttemptWindow" AS attempt_window
       SET "lockedUntil" = $1, "failureTimestamps" = ARRAY[]::timestamp(3)[]
       FROM "user" AS account
       WHERE attempt_window."userId" = account."id"
         AND account."normalizedEmail" = $2`,
      [new Date(0), email.toLowerCase()],
    );
  } finally {
    await client.end();
  }
}

async function fillPasswordForm(
  page: Page,
  current: string,
  next = newPassword,
) {
  const region = page.getByRole("region", { name: "Change password" });
  await region.getByLabel("Current password").fill(current);
  await region.getByLabel("New password", { exact: true }).fill(next);
  await region.getByLabel("Confirm new password").fill(next);
  return region;
}

test("locks failures, expires safely, changes password, and revokes only other sessions", async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const first = await registerVerifyAndLogin(browser);
  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  await secondPage.goto("/login");
  await secondPage.getByLabel("Email address").fill(first.email);
  await secondPage
    .getByLabel("Password", { exact: true })
    .fill(currentPassword);
  await secondPage.getByRole("button", { name: "Sign in" }).click();
  await expect(secondPage).toHaveURL(/\/dashboard$/);

  await first.page.goto("/profile/security");
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const region = await fillPasswordForm(
      first.page,
      `wrong current password ${attempt}`,
    );
    await region.getByRole("button", { name: "Change password" }).click();
    await expect(region.getByRole("alert")).toContainText(/current password/i);
  }
  let region = await fillPasswordForm(first.page, currentPassword);
  await region.getByRole("button", { name: "Change password" }).click();
  await expect(region.getByRole("alert")).toContainText(/try again|locked/i);

  await expireAttemptLock(first.email);
  await first.page.reload();
  const beforeNotice = new Set(await readdir(mailDirectory).catch(() => []));
  region = await fillPasswordForm(first.page, currentPassword);
  await region.getByRole("button", { name: "Change password" }).click();
  await expect(region.getByRole("status")).toContainText(/password changed/i);
  expect(
    (await first.page.request.get("/api/identity/sessions")).status(),
  ).toBe(200);

  const revocationStarted = Date.now();
  await expect
    .poll(
      async () =>
        (await secondPage.request.get("/api/identity/sessions")).status(),
      { timeout: 2_000 },
    )
    .toBe(401);
  expect(Date.now() - revocationStarted).toBeLessThanOrEqual(2_000);

  const notice = await waitForMail(beforeNotice, first.email);
  expect(notice).not.toMatch(
    /current password|new password|session(?:Id| token)|cookie|hash/i,
  );
  await signIn(browser, first.email, currentPassword, false);
  await signIn(browser, first.email, newPassword, true);
  await secondContext.close();
  await first.context.close();
});
