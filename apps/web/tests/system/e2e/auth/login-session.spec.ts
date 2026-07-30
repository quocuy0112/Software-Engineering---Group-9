import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const password = "correct horse 2026";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

async function openWorkspaceMenu(page: Page) {
  const menu = page.getByRole("button", {
    name: /^(Menu|Open workspace menu)$/,
  });
  if (await menu.isVisible().catch(() => false)) await menu.click();
}

test("lists, revokes, evicts, and signs out opaque database sessions", async ({
  browser,
  page,
}) => {
  test.setTimeout(240000);
  const email = `login-e2e-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  const mail = resolve(process.cwd(), ".local/mail");
  const before = new Set(await readdir(mail).catch(() => []));

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
        if (body.includes(`To: ${email}`)) {
          link =
            body.match(
              /http:\/\/localhost:3001\/verify-email\?token=[A-Za-z0-9._~-]+/,
            )?.[0] ?? "";
        }
      }
      return Boolean(link);
    })
    .toBe(true);

  await page.goto(link);
  await expect(
    page.getByRole("heading", { name: "Email verified" }),
  ).toBeVisible();
  await signIn(page, email);

  const primaryCookies = await page.context().cookies();
  expect(
    primaryCookies.filter((cookie) => cookie.name === "smarthire.session"),
  ).toHaveLength(1);

  const contexts = [];
  try {
    const selectedContext = await browser.newContext();
    contexts.push(selectedContext);
    const selectedPage = await selectedContext.newPage();
    await signIn(selectedPage, email);

    await page.goto("/settings/sessions");
    await expect(page.getByText(/\(current\)/)).toBeVisible();
    const sessionRows = page.locator("main section ul > li");
    await expect(sessionRows).toHaveCount(2);
    const revokeResponse = page.waitForResponse(
      (response) =>
        /\/api\/identity\/sessions\/[A-Za-z0-9_-]+$/.test(
          new URL(response.url()).pathname,
        ) && response.request().method() === "DELETE",
    );
    await page.getByRole("button", { name: "Revoke session" }).click();
    expect((await revokeResponse).status()).toBe(200);
    await expect(
      page.getByRole("status").filter({ hasText: "Session revoked" }).first(),
    ).toBeVisible();
    await expect(sessionRows).toHaveCount(1);

    await selectedPage.goto("/");
    await expect(selectedPage).toHaveURL(/\/$/);
    await expect(
      selectedPage.getByRole("link", { name: "Sign in", exact: true }),
    ).toBeVisible();
    await selectedContext.close();
    contexts.splice(0, 1);

    const activePages: Page[] = [];
    for (let index = 0; index < 5; index += 1) {
      const context = await browser.newContext();
      contexts.push(context);
      const contextPage = await context.newPage();
      await signIn(contextPage, email);
      activePages.push(contextPage);
    }

    const newestPage = activePages.at(-1)!;
    await newestPage.goto("/settings/sessions");
    await expect(newestPage.locator("main section ul > li")).toHaveCount(5);
    await expect(newestPage.getByText(/\(current\)/)).toHaveCount(1);

    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);

    await openWorkspaceMenu(newestPage);
    await newestPage.getByRole("button", { name: "Sign out" }).click();
    await expect(newestPage).toHaveURL(/\/login$/);
    expect(
      (await newestPage.context().cookies()).filter(
        (cookie) => cookie.name === "smarthire.session",
      ),
    ).toHaveLength(0);
    await newestPage.goto("/");
    await expect(newestPage).toHaveURL(/\/$/);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
