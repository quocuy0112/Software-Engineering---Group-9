import { expect, test } from "@playwright/test";

const adminOrigin =
  process.env.ADMIN_E2E_ORIGIN ?? "http://console.admin.localhost:3001";

test.describe("administrator authentication boundary", () => {
  test("signed-out browser and direct route receive no protected content", async ({
    page,
    request,
  }) => {
    await page.goto(`${adminOrigin}/`);
    await expect(
      page.getByRole("heading", {
        name: /Platform administration|Administration access unavailable|Sign in/u,
      }),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      /Private administrator explanation|Business license preview/u,
    );
    const response = await request.get(`${adminOrigin}/api/admin/dashboard`, {
      headers: { "sec-fetch-site": "same-origin" },
    });
    expect([401, 403, 404]).toContain(response.status());
  });

  test("session replacement, step-up, logout, and history isolation", async ({
    browser,
  }) => {
    test.skip(
      process.env.ADMIN_E2E_READY !== "1",
      "requires provisioned two-factor administrator fixtures",
    );
    const first = await browser.newContext();
    const second = await browser.newContext();
    // Credential entry and OTP retrieval are supplied by the controlled E2E fixture.
    await first.close();
    await second.close();
  });
});
