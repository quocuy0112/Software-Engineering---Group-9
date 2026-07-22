import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
test("verified account signs in with one opaque cookie, reaches settings, and signs out", async ({
  page,
}) => {
  const email = `login-e2e-${Date.now()}@example.test`,
    password = "correct horse 2026",
    mail = resolve(process.cwd(), ".local/mail"),
    before = new Set(await readdir(mail).catch(() => []));
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Login Candidate");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();
  let link = "";
  await expect
    .poll(async () => {
      for (const name of (await readdir(mail)).filter(
        (item) => !before.has(item),
      )) {
        const body = await readFile(resolve(mail, name), "utf8");
        if (body.includes(`To: ${email}`))
          link =
            body.match(
              /http:\/\/localhost:3000\/verify-email\?token=[A-Za-z0-9._~-]+/,
            )?.[0] ?? "";
      }
      return Boolean(link);
    })
    .toBe(true);
  await page.goto(link);
  await expect(
    page.getByRole("heading", { name: "Email verified" }),
  ).toBeVisible();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  const dashboardMenuButton = page.getByRole("button", { name: "Menu" });
  if (await dashboardMenuButton.isVisible()) {
    await dashboardMenuButton.click();
  }
  await page.getByRole("link", { name: "Sessions", exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/sessions/);
  await expect(page.getByText(/\(current\)/)).toBeVisible();
  const cookies = await page.context().cookies();
  expect(
    cookies.filter((cookie) => cookie.name === "smarthire.session"),
  ).toHaveLength(1);
  const menuButton = page.getByRole("button", { name: "Menu" });
  if (await menuButton.isVisible()) {
    await menuButton.click();
  }
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(
    (await page.context().cookies()).filter(
      (cookie) => cookie.name === "smarthire.session",
    ),
  ).toHaveLength(0);
});
