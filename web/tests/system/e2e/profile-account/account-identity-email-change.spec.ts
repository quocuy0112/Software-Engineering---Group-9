import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const password = "Account Identity 2026!";
const mailDirectory = resolve(process.cwd(), ".local/mail");

async function waitForMail(
  before: Set<string>,
  recipient: string,
  predicate: (body: string) => boolean,
) {
  let body = "";
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
          if (candidate.includes(`To: ${recipient}`) && predicate(candidate)) {
            body = candidate;
          }
        }
        return Boolean(body);
      },
      { timeout: 60_000 },
    )
    .toBe(true);
  return body;
}

async function registerVerifyAndLogin(
  browser: Browser,
  label: string,
): Promise<{ page: Page; email: string }> {
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
  const verificationMail = await waitForMail(before, email, (body) =>
    body.includes("/verify-email?token="),
  );
  const link =
    verificationMail.match(
      /http:\/\/localhost:3001\/verify-email\?token=[A-Za-z0-9._~-]+/,
    )?.[0] ?? "";
  expect(link).not.toBe("");
  await page.goto(link);
  await page.getByRole("link", { name: "Continue to login" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return { page, email };
}

async function requestEmail(
  page: Page,
  currentEmail: string,
  newEmail: string,
): Promise<{ verificationLink: string; oldAlert: string }> {
  const before = new Set(await readdir(mailDirectory).catch(() => []));
  await page.goto("/profile/account");
  await page.getByLabel("Proposed email").fill(newEmail);
  await page.getByLabel("Current password").fill(password);
  await page
    .getByRole("button", { name: "Request verification email" })
    .click();
  await expect(page.getByRole("status")).toContainText(/verification/i);
  const verificationMail = await waitForMail(before, newEmail, (body) =>
    body.includes("/verify-email-change#proof="),
  );
  const oldAlert = await waitForMail(before, currentEmail, (body) =>
    body.includes("X-SmartHire-Kind: SECURITY_ALERT"),
  );
  const verificationLink =
    verificationMail.match(
      /http:\/\/localhost:3001\/verify-email-change#proof=[A-Za-z0-9._~%=-]+/,
    )?.[0] ?? "";
  expect(verificationLink).not.toBe("");
  return { verificationLink, oldAlert };
}

async function signIn(browser: Browser, email: string, shouldSucceed: boolean) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  if (shouldSucceed) {
    await expect(page).toHaveURL(/\/dashboard$/);
  } else {
    await expect(page).not.toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("alert")).toBeVisible();
  }
  await context.close();
}

test("updates inert identity text and completes a proof-bound email change", async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const first = await registerVerifyAndLogin(browser, "identity-a");
  const page = first.page;
  await page.goto("/profile/account");
  await expect(
    page.getByRole("heading", { name: "Account identity", exact: true }),
  ).toBeVisible();

  await page
    .getByLabel("Full name", { exact: true })
    .fill("Candidate <img src=x onerror=globalThis.identityXss=true> A");
  await page.getByRole("button", { name: "Save full name" }).click();
  await expect(page.getByRole("status")).toContainText(/saved/i);
  await page
    .getByLabel("Full name", { exact: true })
    .fill('Candidate "><script>globalThis.identityXss=true</script> A');
  await page.getByRole("button", { name: "Save full name" }).click();
  await expect(page.getByRole("status")).toContainText(/saved/i);
  await page.reload();
  expect(
    await page.evaluate(() => Reflect.get(globalThis, "identityXss")),
  ).not.toBe(true);
  await expect(page.locator("script", { hasText: "identityXss" })).toHaveCount(
    0,
  );
  await expect(page.locator("img[onerror]")).toHaveCount(0);

  const firstProposed = `superseded-${Date.now()}@example.test`;
  const firstRequest = await requestEmail(page, first.email, firstProposed);
  expect(firstRequest.oldAlert).not.toMatch(
    /proof=|token|\/verify-email-change/i,
  );
  await signIn(browser, first.email, true);

  const finalEmail = `final-${Date.now()}@example.test`;
  const finalRequest = await requestEmail(page, first.email, finalEmail);

  await page.goto(firstRequest.verificationLink);
  await expect.poll(() => page.url()).not.toContain("#proof=");
  await page.getByRole("button", { name: "Confirm email change" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Request a new verification email" }),
  ).toHaveAttribute("href", "/profile/account");

  const second = await registerVerifyAndLogin(browser, "identity-b");
  await second.page.goto("/login");
  await second.page.goto(finalRequest.verificationLink);
  await expect.poll(() => second.page.url()).not.toContain("#proof=");
  await second.page
    .getByRole("button", { name: "Confirm email change" })
    .click();
  await expect(second.page.getByRole("status")).toContainText(
    /verified|changed/i,
  );
  await expect(
    second.page.getByText(finalRequest.verificationLink),
  ).toHaveCount(0);

  await signIn(browser, finalEmail, true);
  await signIn(browser, first.email, false);
  await signIn(browser, second.email, true);

  await second.page.goto("/login");
  await second.page.goto(finalRequest.verificationLink);
  await second.page
    .getByRole("button", { name: "Confirm email change" })
    .click();
  await expect(second.page.getByRole("alert")).toBeVisible();
  await expect(
    second.page.getByRole("link", {
      name: "Request a new verification email",
    }),
  ).toBeVisible();

  await second.page.goto("/login");
  await second.page.goto(
    `/verify-email-change#proof=${"invalid".padEnd(43, "x")}`,
  );
  await expect.poll(() => second.page.url()).not.toContain("#proof=");
  await second.page
    .getByRole("button", { name: "Confirm email change" })
    .click();
  await expect(second.page.getByRole("alert")).toBeVisible();
});
