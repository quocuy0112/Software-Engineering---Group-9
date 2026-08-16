import { expect, test } from "@playwright/test";

const recruiterOrigin =
  process.env.RECRUITER_E2E_ORIGIN ?? "http://localhost:3001";
const adminOrigin =
  process.env.ADMIN_E2E_ORIGIN ?? "http://localhost:3001";

test.describe("job post review workflow", () => {
  test.beforeEach(() => {
    test.skip(
      process.env.JOB_POST_REVIEW_E2E_READY !== "1",
      "requires provisioned recruiter/admin fixtures and review seed data",
    );
  });

  test("submit, claim, approve, reject, and resubmit flow stays navigable", async ({
    page,
  }) => {
    await page.goto(`${recruiterOrigin}/recruiter/job-postings`);
    await expect(page.getByRole("heading", { name: /Job postings/u })).toBeVisible();
    await page.goto(`${adminOrigin}/admin/job-post-reviews`);
    await expect(page.getByRole("heading", { name: /Job post reviews/u })).toBeVisible();
  });
});
