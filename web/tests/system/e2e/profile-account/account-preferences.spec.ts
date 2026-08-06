import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Browser } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const password = "Preferences journey 2026!";
const mailDirectory = resolve(process.cwd(), ".local/mail");

async function registerVerifyAndLogin(browser: Browser, label: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = `${label}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}@example.test`;
  const before = new Set(await readdir(mailDirectory).catch(() => []));
  await page.goto("/register");
  await page
    .getByLabel("Full name", { exact: true })
    .fill(`Candidate ${label}`);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  let verification = "";
  await expect
    .poll(
      async () => {
        for (const name of (await readdir(mailDirectory)).filter(
          (candidate) => !before.has(candidate),
        )) {
          const candidate = await readFile(
            resolve(mailDirectory, name),
            "utf8",
          );
          if (
            candidate.includes(`To: ${email}`) &&
            candidate.includes("/verify-email?token=")
          ) {
            verification = candidate;
          }
        }
        return Boolean(verification);
      },
      { timeout: 60_000 },
    )
    .toBe(true);
  const link =
    verification.match(
      /http:\/\/localhost:3001\/verify-email\?token=[A-Za-z0-9._~-]+/,
    )?.[0] ?? "";
  expect(link).not.toBe("");
  await page.goto(link);
  await page.getByRole("link", { name: "Continue to login" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return { context, page, email };
}

async function signInSecond(browser: Browser, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return { context, page };
}

test("reads defaults, validates and persists a complete owner-scoped preference set", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const owner = await registerVerifyAndLogin(browser, "preferences-owner");
  await owner.page.goto("/profile/preferences");
  await expect(
    owner.page.getByRole("heading", { name: /Preferences|Tùy chọn/ }),
  ).toBeVisible();
  const language = owner.page.locator("#preference-language");
  const timezone = owner.page.locator("#preference-timezone");
  await expect(language).toHaveValue("vi");
  await expect(language).not.toBeDisabled();
  await expect(timezone).toHaveValue("Asia/Ho_Chi_Minh");
  const security = owner.page.getByLabel(/Account security|Bảo mật tài khoản/);
  await expect(security).toBeChecked();
  await expect(security).toBeDisabled();

  await language.selectOption("en");
  await timezone.fill("Mars/Olympus");
  await owner.page
    .getByRole("button", { name: /Save preferences|Lưu tùy chọn/ })
    .click();
  await expect(
    owner.page
      .getByRole("region", { name: "Account preferences" })
      .getByRole("alert"),
  ).toContainText(/supported timezone/i);
  await expect(timezone).toHaveValue("Mars/Olympus");

  await timezone.fill("UTC");
  await owner.page.getByLabel("Application updates").uncheck();
  await owner.page.getByLabel("Job recommendations").uncheck();
  await owner.page.getByRole("button", { name: "Save preferences" }).click();
  await expect(owner.page.getByRole("status")).toContainText(/saved/i);

  const second = await signInSecond(browser, owner.email);
  await second.page.goto("/profile/preferences");
  await expect(second.page.locator("#preference-language")).toHaveValue("en");
  await expect(second.page.locator("#preference-timezone")).toHaveValue("UTC");
  await expect(second.page.getByLabel("Application updates")).not.toBeChecked();
  await expect(second.page.getByLabel("Job recommendations")).not.toBeChecked();
  await expect(second.page.getByLabel("Account security")).toBeChecked();

  const other = await registerVerifyAndLogin(browser, "preferences-other");
  await other.page.goto("/profile/preferences");
  await expect(other.page.locator("#preference-language")).toHaveValue("vi");
  await other.page.locator("#preference-timezone").fill("Europe/Paris");
  await other.page
    .getByRole("button", { name: /Save preferences|Lưu tùy chọn/ })
    .click();
  await expect(other.page.getByRole("status")).toContainText(/saved|lưu/i);
  await owner.page.reload();
  await expect(owner.page.locator("#preference-timezone")).toHaveValue("UTC");

  await second.context.close();
  await other.context.close();
  await owner.context.close();
});
