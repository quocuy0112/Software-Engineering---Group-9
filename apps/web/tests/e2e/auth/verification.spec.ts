import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

test("shows generic invalid/reused outcomes and supports safe resend", async ({ page }) => {
  const email = `verification-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  const mailDirectory = resolve(process.cwd(), ".local/mail");
  const before = new Set(await readdir(mailDirectory).catch(() => []));
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Verification Candidate");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("correct horse 2026");
  await page.getByLabel("Confirm password").fill("correct horse 2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  let link = "";
  await expect.poll(async () => {
    for (const name of (await readdir(mailDirectory)).filter((item) => !before.has(item))) {
      const body = await readFile(resolve(mailDirectory, name), "utf8");
      link = body.match(/http:\/\/localhost:3000\/verify-email\?token=[A-Za-z0-9._~-]+/)?.[0] ?? link;
    }
    return Boolean(link);
  }).toBe(true);
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Verification link unavailable" })).toBeVisible();
  await expect(page.getByText(/The link is invalid, expired, already used/i)).toBeVisible();

  await page.getByLabel("Email address").fill(email);
  const resend = page.waitForResponse(
    (response) => response.url().endsWith("/api/identity/verification/resend") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Resend verification" }).click();
  expect((await resend).status()).toBe(202);
  await expect(page.getByRole("status")).toContainText(/eligible account exists/i);

  await page.goto("/verify-email?token=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  await expect(page.getByRole("heading", { name: "Verification link unavailable" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to sign in" })).toBeVisible();
});
