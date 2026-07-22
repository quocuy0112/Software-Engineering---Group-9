import { expect, test } from "@playwright/test";

test("forgot-password and reset-password surfaces remain generic and safe", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill(`recovery-e2e-${Date.now()}@example.test`);
  const forgotResponse = page.waitForResponse(
    (response) => response.url().endsWith("/api/identity/password/forgot") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /send reset instructions/i }).click();
  const response = await forgotResponse;
  expect(response.status()).toBe(202);
  expect((await response.json()).message).toMatch(/eligible|instructions/i);
  await expect(page.getByRole("status")).toContainText("eligible");

  await page.goto("/reset-password#token=opaque-browser-token");
  await page.getByLabel("New password", { exact: true }).fill("correct horse 2026");
  await page.getByLabel("Confirm new password", { exact: true }).fill("correct horse 2026");
  const resetResponse = page.waitForResponse(
    (result) => result.url().endsWith("/api/identity/password/reset") && result.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Reset password" }).click();
  const reset = await resetResponse;
  expect(reset.status()).toBe(400);
  expect((await reset.json()).message).toMatch(/invalid|expired/i);
  await expect(page.getByRole("status")).toContainText("invalid or has expired");
  expect(await page.locator("body").innerText()).not.toContain("opaque-browser-token");
});
