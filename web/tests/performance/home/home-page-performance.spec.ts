import { expect, test, type Browser, type Page } from "@playwright/test";
import { runHomeE2EControl } from "../../helpers/home/home-e2e-control";

const visitorCount = 10;
const rounds = 10;

function percentile95(values: readonly number[]) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.max(0, Math.ceil(ordered.length * 0.95) - 1)] ?? Infinity;
}

async function createVisitors(browser: Browser) {
  return Promise.all(
    Array.from({ length: visitorCount }, async () => {
      const context = await browser.newContext();
      return { context, page: await context.newPage() };
    }),
  );
}

async function selectEnglish(page: Page) {
  await page.getByLabel(/^(?:Home language|Ngôn ngữ trang chủ)$/u).selectOption("en");
}

test("measures 100 concurrent-visitor Home and search samples against the required dataset", async ({ browser }, testInfo) => {
  const datasetSize = (await runHomeE2EControl<{ count: number }>("public-job-count")).count;
  expect(datasetSize, "performance evidence requires at least 1,000 active public jobs").toBeGreaterThanOrEqual(1_000);

  const visitors = await createVisitors(browser);
  const homeDurations: number[] = [];
  const searchDurations: number[] = [];
  const errors: string[] = [];
  const startedAt = new Date();
  try {
    for (let round = 0; round < rounds; round += 1) {
      await Promise.all(visitors.map(async ({ page }, visitor) => {
        try {
          const homeStarted = performance.now();
          await page.goto("/", { waitUntil: "domcontentloaded" });
          await page.getByRole("heading", { level: 1 }).waitFor();
          homeDurations.push(performance.now() - homeStarted);
          await selectEnglish(page);
          await page.getByLabel("Keyword").fill(`typescript ${round}-${visitor}`);
          const searchStarted = performance.now();
          await page.getByRole("button", { name: "Search jobs" }).click();
          await page.waitForURL(/\/jobs\?/u);
          await page.getByRole("main").waitFor();
          searchDurations.push(performance.now() - searchStarted);
        } catch (error) {
          errors.push(error instanceof Error ? error.message : "unknown browser error");
        }
      }));
    }
  } finally {
    await Promise.all(visitors.map(({ context }) => context.close()));
  }

  const report = {
    project: testInfo.project.name,
    environment: process.env.CI ? "CI" : "local",
    externalConditions: "existing local application/database; no Home test endpoint",
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    datasetSize,
    concurrentVisitors: visitorCount,
    measuredSamples: { home: homeDurations.length, search: searchDurations.length },
    method: "nearest-rank P95 over browser-observed navigation-to-visible samples",
    home: { p95Ms: percentile95(homeDurations), maximumMs: Math.max(...homeDurations) },
    search: { p95Ms: percentile95(searchDurations), maximumMs: Math.max(...searchDurations) },
    errorRate: errors.length / (visitorCount * rounds * 2),
    errors: errors.slice(0, 10),
  };
  await testInfo.attach("home-performance-report", {
    body: JSON.stringify(report, null, 2),
    contentType: "application/json",
  });
  expect(homeDurations).toHaveLength(100);
  expect(searchDurations).toHaveLength(100);
  expect(report.errorRate).toBe(0);
  expect(report.home.p95Ms).toBeLessThanOrEqual(3_000);
  expect(report.search.p95Ms).toBeLessThanOrEqual(2_000);
});
