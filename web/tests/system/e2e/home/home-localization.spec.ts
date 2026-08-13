import { expect, test } from "@playwright/test";
import { setHomeLocale } from "./home-e2e-fixture";

test("locale switching covers visible and assistive Home copy without changing records or search state", async ({ page }) => {
  await page.goto("/");
  await setHomeLocale(page, "en");
  const firstJob = page.locator(".home-job-card h3").first();
  const recordTitle = await firstJob.textContent();
  await page.getByLabel("Keyword").fill("TypeScript");
  await page.getByLabel("Location").fill("Hà Nội");
  await page.getByLabel("Home language").selectOption("vi");
  await expect(page.getByRole("heading", { name: "Tìm đúng công việc. Gặp đúng đội ngũ. Phát triển đúng hướng." })).toBeVisible();
  await expect(page.getByLabel("Mở menu điều hướng")).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByLabel("Từ khóa")).toHaveValue("TypeScript");
  await expect(page.getByLabel("Địa điểm")).toHaveValue("Hà Nội");
  if (recordTitle) await expect(firstJob).toHaveText(recordTitle);
  await page.getByLabel("Ngôn ngữ trang chủ").selectOption("en");
  await expect(page.getByText("Illustrative Smart Match example")).toBeVisible();
});
