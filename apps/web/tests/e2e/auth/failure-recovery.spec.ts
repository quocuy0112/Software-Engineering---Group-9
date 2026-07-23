import { expect, test } from "@playwright/test";
import { failRegistrationRequest, failResendRequest } from "../fixtures/failures";

test("renders recoverable registration and email-provider failures without false auth", async ({ page }) => {
  await failRegistrationRequest(page);
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Failure Candidate");
  await page.getByLabel("Email address").fill(`failure-${Date.now()}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("correct horse 2026");
  await page.getByLabel("Confirm password").fill("correct horse 2026");
  const response = page.waitForResponse(
    (result) => result.url().endsWith("/api/identity/register") && result.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create account" }).click();
  expect((await response).status()).toBe(503);
  await expect(page.getByRole("alert").filter({ hasText: /could not|try again/i })).toBeVisible();
  expect((await page.context().cookies()).some((cookie) => cookie.name.includes("session"))).toBe(false);

  await page.unroute("**/api/identity/register");
  await failResendRequest(page);
  await page.goto("/verify-email?token=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  await expect(page.getByRole("heading", { name: "Verification link unavailable" })).toBeVisible();
  await page.getByLabel("Email address").fill("failure@example.test");
  const resend = page.waitForResponse(
    (result) => result.url().endsWith("/api/identity/verification/resend") && result.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Resend verification" }).click();
  expect((await resend).status()).toBe(503);
  await expect(page.getByRole("status")).toContainText(/eligible account exists/i);
});
