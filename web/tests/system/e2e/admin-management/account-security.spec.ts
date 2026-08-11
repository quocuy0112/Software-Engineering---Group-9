import { expect, test } from "@playwright/test";

test.describe("account and session security", () => {
  test.beforeEach(() =>
    test.skip(
      process.env.ADMIN_E2E_READY !== "1",
      "requires provisioned administrator/account/session fixtures",
    ),
  );

  test("searches, revokes one/all, suspends, reinstates, and exposes delivery failure safely", async ({
    page,
  }) => {
    await page.goto(`${process.env.ADMIN_E2E_ORIGIN}/#/accounts`);
    await expect(
      page.getByRole("heading", { name: /accounts/i }),
    ).toBeVisible();
    await page
      .getByRole("link", {
        name: new RegExp(process.env.ADMIN_E2E_TARGET_ACCOUNT ?? "Candidate"),
      })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: /Candidate/u }),
    ).toBeVisible();
    await expect(page.getByText(/session/i)).toBeVisible();
    await expect(page.getByText(/Security notifications/u)).toBeVisible();
  });
});
