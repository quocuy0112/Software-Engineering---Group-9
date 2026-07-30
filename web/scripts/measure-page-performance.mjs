import { chromium } from "@playwright/test";

const baseUrl = process.env.PERF_BASE_URL ?? "http://localhost:3001";
const iterations = Number.parseInt(process.env.PERF_ITERATIONS ?? "100", 10);
const routes = (
  process.env.PERF_ROUTES ??
  "/register,/login,/forgot-password,/reset-password,/verify-email,/check-email,/two-factor"
)
  .split(",")
  .map((route) => route.trim())
  .filter(Boolean);

if (!Number.isInteger(iterations) || iterations < 2) {
  throw new Error("PERF_ITERATIONS must be an integer greater than one");
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  reducedMotion: "reduce",
  viewport: { width: 1280, height: 720 },
});
const page = await context.newPage();
const results = [];

try {
  for (const route of routes) {
    const timings = [];
    await page.goto(new URL(route, baseUrl).href, {
      waitUntil: "domcontentloaded",
    });

    for (let index = 0; index < iterations; index += 1) {
      const startedAt = performance.now();
      await page.goto(new URL(route, baseUrl).href, {
        waitUntil: "domcontentloaded",
      });
      timings.push(performance.now() - startedAt);
    }

    timings.sort((left, right) => left - right);
    const percentile = (fraction) =>
      timings[
        Math.min(timings.length - 1, Math.ceil(timings.length * fraction) - 1)
      ];
    results.push({
      route,
      iterations,
      p50Ms: percentile(0.5),
      p95Ms: percentile(0.95),
      maxMs: timings.at(-1),
    });
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ baseUrl, iterations, routes: results }, null, 2));
