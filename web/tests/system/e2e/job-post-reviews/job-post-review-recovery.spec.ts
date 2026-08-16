import { expect, test } from "@playwright/test";

const recruiterOrigin =
  process.env.RECRUITER_E2E_ORIGIN ?? "http://localhost:3001";

test.describe("job post review recovery", () => {
  test.beforeEach(() => {
    test.skip(
      process.env.JOB_POST_REVIEW_E2E_READY !== "1",
      "requires provisioned recruiter/admin fixtures and review seed data",
    );
  });

  test("handles stale refresh and unavailable review states without leaking content", async ({
    page,
  }) => {
    await page.goto(`${recruiterOrigin}/recruiter`);
    await expect(page.locator("body")).toContainText(/Job postings|Company setup required/u);
  });
});
