import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const password = "Professional Profile 2026!";

async function registerVerifyAndLogin(
  browser: Browser,
  label: string,
): Promise<{ page: Page; email: string }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = `${label}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}@example.test`;
  const mailDirectory = resolve(process.cwd(), ".local/mail");
  const before = new Set(await readdir(mailDirectory).catch(() => []));
  await page.goto("/register");
  await page.getByLabel("Full name").fill(`Candidate ${label}`);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();

  let verificationLink = "";
  await expect
    .poll(
      async () => {
        for (const name of (await readdir(mailDirectory)).filter(
          (candidate) => !before.has(candidate),
        )) {
          const body = await readFile(resolve(mailDirectory, name), "utf8");
          if (body.includes(`To: ${email}`)) {
            verificationLink =
              body.match(
                /http:\/\/localhost:3001\/verify-email\?token=[A-Za-z0-9._~-]+/,
              )?.[0] ?? "";
          }
        }
        return verificationLink;
      },
      { timeout: 15_000 },
    )
    .not.toBe("");
  await page.goto(verificationLink);
  await page.getByRole("link", { name: "Continue to login" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/profile");
  return { page, email };
}

test("saves a complete owned profile, reports stale writes, and keeps XSS inert", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const first = await registerVerifyAndLogin(browser, "professional-a");
  const page = first.page;
  await expect(
    page.getByRole("heading", {
      name: "Professional profile",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/not filled yet/i)).toBeVisible();

  await page
    .getByLabel("Headline")
    .fill("Engineer <img src=x onerror=globalThis.profileXss=true>");
  await page
    .getByLabel("Summary")
    .fill('"><script>globalThis.profileXss=true</script> Builds products');
  await page.getByLabel("Phone").fill("+84 912 345 678");
  await page.getByLabel("Location").fill("Hồ Chí Minh");
  await page.getByRole("button", { name: "Save basics" }).click();
  await expect(page.getByRole("status")).toContainText(/saved/i);
  expect(
    await page.evaluate(() => Reflect.get(globalThis, "profileXss")),
  ).not.toBe(true);
  await expect(page.locator("script", { hasText: "profileXss" })).toHaveCount(
    0,
  );
  await expect(page.locator("img[onerror]")).toHaveCount(0);

  await page.getByRole("button", { name: "Add skill" }).click();
  await page.getByLabel("Skill 1", { exact: true }).fill("TypeScript");
  await page.getByRole("button", { name: "Add skill" }).click();
  await page.getByLabel("Skill 2", { exact: true }).fill("PostgreSQL");
  await page.getByRole("button", { name: "Move skill 2 up" }).click();
  await page.getByRole("button", { name: "Save skills" }).click();
  await expect(page.getByRole("status")).toContainText(/saved/i);

  await page.getByRole("button", { name: "Add experience" }).click();
  const experience = page.getByRole("group", { name: "Experience 1" });
  await experience.getByLabel("Title").fill("Engineer");
  await experience.getByLabel("Company").fill("SmartHire");
  await experience.getByLabel("Start date").fill("2025-01-01");
  await experience.getByLabel("Current role").check();
  await page.getByRole("button", { name: "Save experience" }).click();

  await page.getByRole("button", { name: "Add education" }).click();
  const education = page.getByRole("group", { name: "Education 1" });
  await education.getByLabel("Institution").fill("University");
  await education.getByLabel("Degree").fill("BSc");
  await education.getByLabel("Start date").fill("2020-01-01");
  await education.getByLabel("End date").fill("2024-01-01");
  await page.getByRole("button", { name: "Save education" }).click();

  await page
    .getByLabel("Profile or website link", { exact: true })
    .fill("https://github.com/example");
  await page.getByRole("button", { name: "Add link" }).click();
  await page.getByRole("button", { name: "Save social links" }).click();
  await page.reload();
  await expect(page.getByLabel("Headline")).toHaveValue("Engineer");
  await expect(page.getByLabel("Skill 1", { exact: true })).toHaveValue(
    "PostgreSQL",
  );

  const stalePage = await page.context().newPage();
  await stalePage.goto("/profile");
  await page.getByLabel("Headline").fill("First session update");
  await page.getByRole("button", { name: "Save basics" }).click();
  await stalePage.getByLabel("Headline").fill("Stale session update");
  await stalePage.getByRole("button", { name: "Save basics" }).click();
  await expect(stalePage.getByRole("status")).toContainText(
    /another session|newer/i,
  );

  const firstExperienceResponse = await page.request.get(
    "/api/account/profile",
  );
  const firstProfile = await firstExperienceResponse.json();
  const foreignExperienceId = firstProfile.experience[0].id as string;

  const second = await registerVerifyAndLogin(browser, "professional-b");
  let mutationHeaders: Record<string, string> = {};
  second.page.on("request", (request) => {
    if (
      request.url().endsWith("/api/account/profile") &&
      request.method() === "PATCH"
    ) {
      mutationHeaders = request.headers();
    }
  });
  await second.page.getByLabel("Headline").fill("Second account");
  await second.page.getByRole("button", { name: "Save basics" }).click();
  await expect(second.page.getByRole("status")).toContainText(/saved/i);
  const denied = await second.page.request.patch("/api/account/profile", {
    headers: {
      "content-type": "application/json",
      origin: mutationHeaders.origin ?? "http://localhost:3001",
      "sec-fetch-site": "same-origin",
      "x-csrf-token": mutationHeaders["x-csrf-token"] ?? "",
    },
    data: {
      section: "experience",
      baseRevision: 1,
      experience: [
        {
          id: foreignExperienceId,
          title: "Forged",
          company: "Denied",
          description: null,
          startDate: "2025-01-01",
          endDate: null,
          current: true,
        },
      ],
    },
  });
  expect([400, 403]).toContain(denied.status());
  expect(JSON.stringify(await denied.json())).not.toContain(
    foreignExperienceId,
  );
});
