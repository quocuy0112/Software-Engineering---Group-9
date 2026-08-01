import { resolve } from "node:path";
import { config as loadEnvironment } from "dotenv";
import { expect, test } from "@playwright/test";

loadEnvironment({ path: resolve(process.cwd(), ".env.local"), quiet: true });

let fixture: Awaited<
  ReturnType<
    typeof import("../../../helpers/job-board-database-fixture").createJobBoardDatabaseFixture
  >
>;

test.beforeAll(async () => {
  fixture = await (
    await import("../../../helpers/job-board-database-fixture")
  ).createJobBoardDatabaseFixture("e2e-discovery");
});

test.afterAll(async () => {
  if (fixture)
    await (
      await import("../../../helpers/job-board-database-fixture")
    ).deleteJobBoardDatabaseFixture(fixture);
});

test("browses, filters, opens public details, and remains usable at the project viewport", async ({
  page,
}) => {
  await page.goto("/jobs");
  await expect(
    page.getByRole("heading", { name: "Find work that fits" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: fixture.jobs.active.title }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: fixture.jobs.pending.title }),
  ).toHaveCount(0);

  await page.getByLabel("Keywords").fill("typescript");
  await page.getByLabel("Location").fill("ho chi minh");
  await page.getByLabel("Work arrangement").selectOption("HYBRID");
  await page.getByRole("button", { name: "Search jobs" }).click();
  await expect(page).toHaveURL(/q=typescript/u);
  await expect(
    page.getByRole("link", { name: fixture.jobs.active.title }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: fixture.jobs.activeSecond.title }),
  ).toHaveCount(0);

  await page.getByRole("link", { name: fixture.jobs.active.title }).click();
  await expect(
    page.getByRole("heading", { name: fixture.jobs.active.title }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Requirements" }),
  ).toBeVisible();
  await expect(page.getByLabel("Job status: Active")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
