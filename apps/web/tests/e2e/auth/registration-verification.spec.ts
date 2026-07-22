import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

test("registers without a session, captures email, and verifies the account", async ({
  page,
}) => {
  const email = `playwright-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  const mailDirectory = resolve(process.cwd(), ".local/mail");
  const before = new Set(await readdir(mailDirectory).catch(() => []));
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Playwright Candidate");
  await page.getByLabel("Email address").fill(email.toUpperCase());
  await page.getByLabel("Password", { exact: true }).fill("correct horse 2026");
  await page.getByLabel("Confirm password").fill("correct horse 2026");
  await page.getByRole("button", { name: "Create account" }).press("Enter");
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();
  const cookies = await page.context().cookies();
  expect(
    cookies.filter((cookie) => cookie.name.includes("session")),
  ).toHaveLength(0);
  await expect
    .poll(async () => {
      const candidates = (await readdir(mailDirectory)).filter(
        (name) => !before.has(name),
      );
      const bodies = await Promise.all(
        candidates.map((name) =>
          readFile(resolve(mailDirectory, name), "utf8"),
        ),
      );
      return bodies.filter((body) =>
        body.includes(`To: ${email.toLowerCase()}`),
      ).length;
    })
    .toBe(1);
  const candidates = (await readdir(mailDirectory)).filter(
    (name) => !before.has(name),
  );
  const created = (
    await Promise.all(
      candidates.map(async (name) => ({
        name,
        body: await readFile(resolve(mailDirectory, name), "utf8"),
      })),
    )
  ).find((entry) => entry.body.includes(`To: ${email.toLowerCase()}`))?.name;
  const message = await readFile(resolve(mailDirectory, created!), "utf8");
  const link = message.match(
    /http:\/\/localhost:3000\/verify-email\?token=[A-Za-z0-9._~-]+/,
  )?.[0];
  expect(link).toBeTruthy();
  await page.goto(link!);
  await expect(
    page.getByRole("heading", { name: "Email verified" }),
  ).toBeVisible();
});

test("keeps keyboard-accessible validation visible at 320px", async ({
  page,
}) => {
  await page.goto("/register");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "SmartHire" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Create account", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Forgot password", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Full name")).toBeFocused();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Enter your name.")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
