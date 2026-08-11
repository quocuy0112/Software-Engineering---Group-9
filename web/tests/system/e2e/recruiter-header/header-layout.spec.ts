import { test, expect } from "@playwright/test";

test.describe("recruiter header responsive layout", () => {
  test.skip(
    !process.env.RECRUITER_HEADER_E2E,
    "Requires an authenticated seeded Candidate session and configured multi-origin host.",
  );

  for (const width of [1440, 1024, 1023, 761, 760, 479, 320]) {
    test(
      "keeps the action row contained at " + width + "px",
      async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/dashboard");
        await expect(page.locator(".workspace-header-actions")).toBeVisible();
        await expect(page.locator("body")).toHaveCSS("overflow-x", "visible");
      },
    );
  }
});
