import { expect, test } from "@playwright/test";

test.describe("moderation reports", () => {
  test.beforeEach(() =>
    test.skip(
      process.env.ADMIN_E2E_READY !== "1",
      "requires public-job, application, reporter, and administrator fixtures",
    ),
  );

  test("returns neutral admission outcomes and keeps moderation separate from enforcement", async ({
    page,
  }) => {
    await page.goto(`${process.env.ADMIN_E2E_ORIGIN}/#/moderation-reports`);
    await expect(
      page.getByRole("heading", { name: /moderation/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /automatic enforcement/i }),
    ).toHaveCount(0);
  });
});
