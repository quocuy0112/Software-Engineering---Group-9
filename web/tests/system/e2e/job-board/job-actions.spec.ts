import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { config as loadEnvironment } from "dotenv";
import { expect, test } from "@playwright/test";

loadEnvironment({ path: resolve(process.cwd(), ".env.local"), quiet: true });

const password = "Job board candidate 2026!";
let fixture: Awaited<
  ReturnType<
    typeof import("../../../helpers/job-board-database-fixture").createJobBoardDatabaseFixture
  >
>;
let email = "";

test.beforeAll(async () => {
  fixture = await (
    await import("../../../helpers/job-board-database-fixture")
  ).createJobBoardDatabaseFixture("e2e-actions");
  const prisma = (await import("@/backend/database/prisma")).prisma;
  const hashPassword = (await import("better-auth/crypto")).hashPassword;
  const user = await prisma.userAccount.findUniqueOrThrow({
    where: { id: fixture.userIds[0] },
    select: { email: true },
  });
  email = user.email;
  await prisma.authProviderAccount.create({
    data: {
      id: randomUUID(),
      accountId: fixture.userIds[0]!,
      providerId: "credential",
      userId: fixture.userIds[0]!,
      password: await hashPassword(password),
    },
  });
});

test.afterAll(async () => {
  if (fixture)
    await (
      await import("../../../helpers/job-board-database-fixture")
    ).deleteJobBoardDatabaseFixture(fixture);
});

test("returns after login and recovers through save, report, and application actions", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const detailPath = `/jobs/${fixture.jobs.active.slug}`;
  await page.goto(detailPath);
  await page.getByRole("link", { name: "Sign in to apply" }).click();
  await expect(page).toHaveURL(/\/login\?returnTo=/u);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(
    new RegExp(`${detailPath.replaceAll("/", "\\/")}$`, "u"),
  );

  await page.route("**/api/saved-jobs/**", async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Try again." }),
      });
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Save job" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Try again." }),
  ).toBeVisible();
  await page.unroute("**/api/saved-jobs/**");
  await page.getByRole("button", { name: "Save job" }).click();
  await expect(
    page.getByRole("button", { name: "Remove saved job" }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Report job" }).click();
  await page.getByLabel("Reason").selectOption("OTHER");
  await page
    .getByLabel(/Details/iu)
    .fill("This posting asks candidates for an unexplained payment.");
  await page.getByRole("button", { name: "Submit report" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /received for review/i }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Apply now" }).click();
  await expect(
    page.getByRole("dialog", {
      name: new RegExp(`Apply for ${fixture.jobs.active.title}`, "i"),
    }),
  ).toBeVisible();
  await page.getByLabel("Select CV").selectOption(fixture.confirmedCvIds[0]!);
  await page.getByLabel(/How many years/iu).fill("Five years");
  await page.getByLabel(/Can you work/iu).selectOption("true");
  await page.getByLabel(/I consent/iu).check();
  await page.getByRole("button", { name: "Submit application" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /submitted/i }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
