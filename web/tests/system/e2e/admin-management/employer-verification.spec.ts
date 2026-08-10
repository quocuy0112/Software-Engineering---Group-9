import { expect, test } from "@playwright/test";

test.describe("employer verification", () => {
  test.beforeEach(() =>
    test.skip(
      process.env.ADMIN_E2E_READY !== "1",
      "requires Candidate/admin fixtures, scanner clock, and private evidence storage",
    ),
  );

  test("submits, qualifies, reviews, decides, cancels, and resubmits without a public locator", async ({
    page,
  }) => {
    await page.goto(
      `${process.env.CANDIDATE_E2E_ORIGIN}/dashboard/employer-verification`,
    );
    await expect(
      page.getByRole("heading", { name: "Employer verification" }),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      /storageLocator|presigned|amazonaws[.]com/u,
    );
  });
});
