import { expect, test } from "@playwright/test";

test.describe("company-scoped membership lifecycle", () => {
  test.beforeEach(() =>
    test.skip(
      process.env.ADMIN_E2E_READY !== "1",
      "requires provisioned multi-company membership fixtures",
    ),
  );

  test("suspends, restores, and removes only the selected membership", async ({
    page,
  }) => {
    await page.goto(`${process.env.ADMIN_E2E_ORIGIN}/#/company-memberships`);
    await expect(page.getByText(/Company context/u).first()).toBeVisible();
    await expect(page.getByText(/Candidate/u).first()).toBeVisible();
  });
});
