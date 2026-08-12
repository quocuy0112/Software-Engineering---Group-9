import { expect, test } from "@playwright/test";
import { setHomeLocale } from "./home-e2e-fixture";

for (const locale of ["en", "vi"] as const) {
  test(`guest discovery preserves six approved filters in ${locale}`, async ({ page }) => {
    await page.goto("/");
    await setHomeLocale(page, locale);
    const labels = locale === "en"
      ? ["Keyword", "Location", "Work arrangement", "Employment type", "Experience level", "Skills"]
      : ["Từ khóa", "Địa điểm", "Hình thức làm việc", "Loại việc làm", "Cấp độ kinh nghiệm", "Kỹ năng"];
    const values = ["frontend", "Hà Nội", "HYBRID", "INTERNSHIP", "ENTRY", "React, TypeScript"];
    await page.getByLabel(labels[0]!).fill(values[0]!);
    await page.getByLabel(labels[1]!).fill(values[1]!);
    await page.getByLabel(labels[2]!).selectOption(values[2]!);
    await page.getByLabel(labels[3]!).selectOption(values[3]!);
    await page.getByLabel(labels[4]!).selectOption(values[4]!);
    await page.getByLabel(labels[5]!).fill(values[5]!);
    await page.getByLabel(locale === "en" ? "Home language" : "Ngôn ngữ trang chủ").selectOption(locale === "en" ? "vi" : "en");
    const switchedLabels = locale === "en"
      ? ["Từ khóa", "Địa điểm", "Hình thức làm việc", "Loại việc làm", "Cấp độ kinh nghiệm", "Kỹ năng"]
      : ["Keyword", "Location", "Work arrangement", "Employment type", "Experience level", "Skills"];
    for (const [index, label] of switchedLabels.entries())
      await expect(page.getByLabel(label!)).toHaveValue(values[index]!);
    await page.getByRole("button", { name: locale === "en" ? "Tìm việc" : "Search jobs" }).click();
    await page.waitForURL(/\/jobs\?/u);
    const url = new URL(page.url());
    expect([...url.searchParams.keys()]).toEqual([
      "q", "location", "workArrangement", "employmentType", "experienceLevel", "skills", "skills",
    ]);
    expect(url.pathname).toBe("/jobs");
  });
}

test("guest conversion actions use existing authentication routes", async ({ page }) => {
  await page.goto("/");
  await setHomeLocale(page, "en");
  await expect(page.getByRole("link", { name: "Create Profile" }).first()).toHaveAttribute("href", "/register");
  await expect(page.getByRole("link", { name: "Post a Job" }).first()).toHaveAttribute(
    "href",
    "/login?returnTo=%2Fdashboard%2Femployer-verification",
  );
});
