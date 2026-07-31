import { expect, test } from "@playwright/test";

test("rejects invalid input and reports an existing registration", async ({
  page,
}) => {
  const email = `duplicate-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  await page.goto("/register");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Enter your name.")).toBeVisible();

  await page.getByLabel("Full name").fill("Existing Candidate");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("correct horse 2026");
  await page.getByLabel("Confirm password").fill("correct horse 2026");
  const first = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/identity/register") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create account" }).click();
  expect((await first).status()).toBe(202);
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Existing Candidate Again");
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("another secure 2026");
  await page.getByLabel("Confirm password").fill("another secure 2026");
  const duplicate = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/identity/register") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create account" }).click();
  expect((await duplicate).status()).toBe(409);
  await expect(
    page.getByText("An account with this email already exists."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toHaveCount(0);
  expect(await page.locator("body").innerText()).not.toContain(email);
});
