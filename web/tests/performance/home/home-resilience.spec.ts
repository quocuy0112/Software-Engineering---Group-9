import { expect, test } from "@playwright/test";

test("performance configuration keeps Home controls usable on both required Chromium projects", async ({ page }, testInfo) => {
  expect(["home-desktop-1366x768", "home-mobile-390x844"]).toContain(testInfo.project.name);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByLabel(/^(?:Home language|Ngôn ngữ trang chủ)$/u).selectOption("en");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByLabel("Keyword")).toBeEnabled();
  await expect(page.getByRole("button", { name: "Search jobs" })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
