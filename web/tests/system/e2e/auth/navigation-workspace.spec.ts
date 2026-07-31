import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const password = "Navigation Passphrase 2026!";

async function openWorkspaceLink(page: Page, name: "Security" | "Sessions") {
  const menu = page.getByRole("button", { name: "Open workspace menu" });
  if (await menu.isVisible()) await menu.click();
  const responsePromise = page.waitForResponse(
    (response) =>
      response
        .url()
        .includes(
          name === "Security" ? "/profile/security" : "/profile/sessions",
        ) && response.status() === 200,
  );
  const startedAt = Date.now();
  await page.getByRole("link", { name, exact: true }).click();
  await responsePromise;
  await expect(page).toHaveURL(
    name === "Security" ? /\/profile\/security$/ : /\/profile\/sessions$/,
    { timeout: 15_000 },
  );
  await expect(page.getByRole("heading", { name })).toBeVisible();
  expect(Date.now() - startedAt).toBeLessThan(2_000);
}

test("connects public auth pages and the protected identity workspace", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const email =
    "navigation-" +
    Date.now() +
    "-" +
    Math.random().toString(16).slice(2) +
    "@example.test";
  const mailDirectory = resolve(process.cwd(), ".local/mail");
  const before = new Set(await readdir(mailDirectory).catch(() => []));

  await page.goto("/login");
  await page.getByRole("link", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(
    page.getByRole("heading", { name: "Create your SmartHire account" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("link", { name: "Forgot password" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(
    page.getByRole("heading", { name: "Forgot your password?" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to sign in" }).click();

  await page.getByRole("link", { name: "Create account" }).click();
  await page.getByLabel("Full name").fill("Navigation Candidate");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();

  let verificationLink = "";
  await expect
    .poll(async () => {
      for (const name of (await readdir(mailDirectory)).filter(
        (candidate) => !before.has(candidate),
      )) {
        const body = await readFile(resolve(mailDirectory, name), "utf8");
        if (body.includes("To: " + email))
          verificationLink =
            body.match(
              /http:\/\/localhost:3001\/verify-email\?token=[A-Za-z0-9._~-]+/,
            )?.[0] ?? "";
      }
      return Boolean(verificationLink);
    })
    .toBe(true);

  await page.goto(verificationLink);
  await expect(
    page.getByRole("heading", { name: "Email verified" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Continue to login" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  const loginResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/identity/login") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sign in" }).click();
  expect((await loginResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  const dashboardMenu = page.getByRole("button", {
    name: "Open workspace menu",
  });
  if (await dashboardMenu.isVisible()) await dashboardMenu.click();
  await expect(
    page.getByRole("link", { name: "Profile", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Profile", exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(
    page.getByRole("heading", { name: "Professional profile", exact: true }),
  ).toBeVisible();
  const profileMenu = page.getByRole("button", {
    name: "Open workspace menu",
  });
  if (await profileMenu.isVisible()) await profileMenu.click();
  await expect(
    page.getByRole("link", { name: "Profile", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  await openWorkspaceLink(page, "Security");
  const securityMenu = page.getByRole("button", {
    name: "Open workspace menu",
  });
  if (await securityMenu.isVisible()) await securityMenu.click();
  await expect(
    page.getByRole("link", { name: "Security", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  // The desktop rail must remain blue and cover the viewport after the long
  // security page scrolls. A transformed ancestor previously made the fixed
  // rail end early and exposed the white page background underneath it.
  await page.setViewportSize({ width: 1440, height: 420 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  expect(
    await page.evaluate(() => {
      const sidebar = document.querySelector<HTMLElement>(".workspace-sidebar");
      const point = document.elementFromPoint(110, window.innerHeight - 1);
      const rect = sidebar?.getBoundingClientRect();
      return {
        coversBottom: Boolean(
          sidebar && point && sidebar.contains(point) && rect,
        ),
        top: rect?.top,
        bottom: rect?.bottom,
        background: sidebar
          ? getComputedStyle(sidebar).backgroundColor
          : "transparent",
      };
    }),
  ).toMatchObject({
    coversBottom: true,
    top: 0,
    bottom: 420,
    background: "rgb(15, 42, 74)",
  });

  await page.setViewportSize({ width: 768, height: 900 });
  await expect(
    page.getByRole("button", { name: "Open workspace menu" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);

  await openWorkspaceLink(page, "Sessions");
  const sessionsMenu = page.getByRole("button", {
    name: "Open workspace menu",
  });
  if (await sessionsMenu.isVisible()) await sessionsMenu.click();
  await expect(
    page.getByRole("link", { name: "Sessions", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  const closeMenu = page.getByRole("button", {
    name: "Close workspace menu",
  });
  if (await closeMenu.isVisible().catch(() => false)) await closeMenu.click();

  await page.goto("/settings/security?proof=discard-me");
  await expect(page).toHaveURL(/\/profile\/security$/);
  await page.goto("/settings/sessions?token=discard-me");
  await expect(page).toHaveURL(/\/profile\/sessions$/);

  await page.setViewportSize({ width: 320, height: 720 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Open workspace menu" }),
  ).toBeVisible();

  const logoutResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/identity/logout") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Open workspace menu" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  expect((await logoutResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
  await expect(
    page.getByRole("heading", { name: "Sign in to SmartHire" }),
  ).toBeVisible();

  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Create account" }),
  ).toHaveAttribute("href", "/register");
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/login",
  );
  await page.goto("/home");
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fdashboard$/);
});
