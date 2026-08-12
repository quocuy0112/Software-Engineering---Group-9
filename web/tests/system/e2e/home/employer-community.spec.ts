import { expect, test } from "@playwright/test";
import { createHomeE2EFixture, deleteHomeE2EFixture, setHomeLocale } from "./home-e2e-fixture";

let fixture: Awaited<ReturnType<typeof createHomeE2EFixture>>;
test.beforeAll(async () => { fixture = await createHomeE2EFixture("community"); });
test.afterAll(async () => { if (fixture) await deleteHomeE2EFixture(fixture); });

test("public navigation resolves anchors and verified companies/curated cards remain display-only", async ({ page }) => {
  await page.goto("/");
  await setHomeLocale(page, "en");
  for (const [name, hash] of [["Career Community", "#community"], ["Companies", "#employer-spotlight"], ["Events", "#events"]]) {
    await page.getByRole("link", { name, exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`${hash}$`, "u"));
  }
  await expect(page.getByRole("heading", { name: fixture.databaseFixture.company.displayName })).toBeVisible();
  for (const selector of [".home-feed-grid", ".home-path-grid", ".home-spotlight-grid", ".home-growth-grid", ".home-events-grid"])
    await expect(page.locator(`${selector} a, ${selector} button`)).toHaveCount(0);
  await expect(page.locator(".home-spotlight-grid").getByText(/mentoring|internship-friendly|work culture/iu)).toHaveCount(0);
  await page.getByLabel("Home language").selectOption("vi");
  await expect(page.getByRole("heading", { name: "Doanh nghiệp nổi bật" })).toBeVisible();
});
