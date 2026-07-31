import { expect, test } from "@playwright/test";

const password = "correct horse 2026";

test("rejects unverified/invalid/throttled login and preserves a safe redirect", async ({
  page,
}) => {
  await page.goto("/settings/sessions");
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fdashboard$/);

  const email = `unverified-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Unverified Candidate");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();

  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  const unverified = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/identity/login") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sign in" }).click();
  expect((await unverified).status()).toBe(401);
  await expect(page.getByRole("status")).toContainText(/incorrect/i);

  await page
    .getByLabel("Email address")
    .fill(`unknown-${Date.now()}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("wrong password 2026");
  const invalid = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/identity/login") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sign in" }).click();
  expect((await invalid).status()).toBe(401);
  expect(
    (await page.context().cookies()).some((cookie) =>
      cookie.name.includes("session"),
    ),
  ).toBe(false);

  const throttledEmail = `throttle-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  const results: number[] = [];
  for (let index = 0; index < 6; index += 1) {
    const response = await page.request.post("/api/identity/login", {
      headers: {
        origin: "http://localhost:3001",
        "sec-fetch-site": "same-origin",
      },
      data: { email: throttledEmail, password: "wrong password 2026" },
    });
    results.push(response.status());
  }
  expect(results.slice(0, 5).every((status) => status === 401)).toBe(true);
  expect(results.at(-1)).toBe(429);
});
