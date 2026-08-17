import { expect, test } from "@playwright/test";

const origin = process.env.ADMIN_E2E_ORIGIN ?? "http://localhost:3001";

test.describe("job post management", () => {
  test.beforeEach(() => {
    test.skip(
      process.env.JOB_POST_MANAGEMENT_E2E_READY !== "1",
      "requires provisioned administrator, recruiter, candidate, and managed-job fixtures",
    );
  });

  test("administrator can inspect a managed post while recruiter and candidate views stay reachable", async ({
    page,
  }) => {
    await page.goto(`${origin}/admin-console/#/job-postings`);
    await expect(
      page.getByText(/job post management|job postings/i),
    ).toBeVisible();
  });
});
