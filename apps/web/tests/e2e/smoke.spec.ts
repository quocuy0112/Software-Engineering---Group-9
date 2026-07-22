import { expect, test } from "@playwright/test";

test("protects the workspace landing page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login\?returnTo=%2F$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
