import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const originalPassword = "correct horse 2026";
const replacementPassword = "renewed mountain pass 2026!";

async function signIn(page: Page, email: string, password = originalPassword) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("forgot-password and reset-password surfaces remain generic and safe", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/forgot-password");
  await page
    .getByLabel("Email address")
    .fill(`recovery-e2e-${Date.now()}@example.test`);
  const forgotResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/identity/password/forgot") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /send reset instructions/i }).click();
  const response = await forgotResponse;
  expect(response.status()).toBe(202);
  expect((await response.json()).message).toMatch(/eligible|instructions/i);
  await expect(page.getByRole("status")).toContainText("eligible");

  await page.goto("/reset-password#token=opaque-browser-token");
  await page.getByLabel("New password", { exact: true }).fill(originalPassword);
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill(originalPassword);
  const resetResponse = page.waitForResponse(
    (result) =>
      result.url().endsWith("/api/identity/password/reset") &&
      result.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Reset password" }).click();
  const reset = await resetResponse;
  expect(reset.status()).toBe(400);
  expect((await reset.json()).message).toMatch(/invalid|expired/i);
  await expect(page.getByRole("status")).toContainText(
    "invalid or has expired",
  );
  expect(await page.locator("body").innerText()).not.toContain(
    "opaque-browser-token",
  );
});

test("resets once, revokes all sessions, sends notification, and requires the new password", async ({
  browser,
  page,
}) => {
  test.setTimeout(240000);
  const email = `recovery-lifecycle-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  const mailDirectory = resolve(process.cwd(), ".local/mail");
  const beforeRegistration = new Set(
    await readdir(mailDirectory).catch(() => []),
  );

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Recovery Candidate");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(originalPassword);
  await page.getByLabel("Confirm password").fill(originalPassword);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();

  let verificationLink = "";
  await expect
    .poll(async () => {
      for (const name of (await readdir(mailDirectory)).filter(
        (item) => !beforeRegistration.has(item),
      )) {
        const body = await readFile(resolve(mailDirectory, name), "utf8");
        if (body.includes(`To: ${email}`)) {
          verificationLink =
            body.match(
              /http:\/\/localhost:3001\/verify-email\?token=[A-Za-z0-9._~-]+/,
            )?.[0] ?? verificationLink;
        }
      }
      return Boolean(verificationLink);
    })
    .toBe(true);

  await page.goto(verificationLink);
  await expect(
    page.getByRole("heading", { name: "Email verified" }),
  ).toBeVisible();
  await signIn(page, email);
  await expect(page).toHaveURL(/\/$/);

  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  try {
    await signIn(otherPage, email);
    await expect(otherPage).toHaveURL(/\/$/);

    const beforeReset = new Set(await readdir(mailDirectory).catch(() => []));
    await page.goto("/forgot-password");
    await page.getByLabel("Email address").fill(email);
    await page
      .getByRole("button", { name: /send reset instructions/i })
      .click();
    await expect(page.getByRole("status")).toContainText("eligible");

    let resetLink = "";
    await expect
      .poll(async () => {
        for (const name of (await readdir(mailDirectory)).filter(
          (item) => !beforeReset.has(item),
        )) {
          const body = await readFile(resolve(mailDirectory, name), "utf8");
          if (body.includes(`To: ${email}`)) {
            resetLink =
              body.match(
                /http:\/\/localhost:3001\/reset-password#token=[A-Za-z0-9._~-]+/,
              )?.[0] ?? resetLink;
          }
        }
        return Boolean(resetLink);
      })
      .toBe(true);

    await page.goto(resetLink);
    await expect.poll(() => page.url()).not.toContain("#token=");
    await page
      .getByLabel("New password", { exact: true })
      .fill(replacementPassword);
    await page
      .getByLabel("Confirm new password", { exact: true })
      .fill(replacementPassword);
    const resetResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/identity/password/reset") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Reset password" }).click();
    expect((await resetResponse).status()).toBe(200);
    await expect(page.getByRole("status")).toContainText(
      "password has been reset",
    );
    expect(
      (await page.context().cookies()).some(
        (cookie) => cookie.name === "smarthire.session",
      ),
    ).toBe(false);

    await otherPage.goto("/");
    await expect(otherPage).toHaveURL(/\/login\?returnTo=%2F$/);

    await expect
      .poll(async () => {
        for (const name of (await readdir(mailDirectory)).filter(
          (item) => !beforeReset.has(item),
        )) {
          const body = await readFile(resolve(mailDirectory, name), "utf8");
          if (
            body.includes(`To: ${email}`) &&
            body.includes("password was changed")
          ) {
            return true;
          }
        }
        return false;
      })
      .toBe(true);

    const reusePage = await page.context().newPage();
    await reusePage.goto(resetLink);
    await reusePage
      .getByLabel("New password", { exact: true })
      .fill(replacementPassword);
    await reusePage
      .getByLabel("Confirm new password", { exact: true })
      .fill(replacementPassword);
    const reusedResponse = reusePage.waitForResponse(
      (response) =>
        response.url().endsWith("/api/identity/password/reset") &&
        response.request().method() === "POST",
    );
    await reusePage.getByRole("button", { name: "Reset password" }).click();
    expect((await reusedResponse).status()).toBe(400);
    await expect(
      reusePage
        .getByRole("status")
        .filter({ hasText: "invalid or has expired" })
        .first(),
    ).toBeVisible();
    await reusePage.close();

    await signIn(page, email, originalPassword);
    await expect(page.getByRole("status")).toContainText(
      /incorrect|could not be completed/i,
    );
    await signIn(page, email, replacementPassword);
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();
  } finally {
    await otherContext.close();
  }
});
