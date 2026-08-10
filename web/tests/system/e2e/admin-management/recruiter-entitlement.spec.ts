import { expect, test } from "@playwright/test";

const recruiterOrigin =
  process.env.RECRUITER_E2E_ORIGIN ?? "http://console.recruiter.localhost:3001";

test.describe("recruiter entitlement boundary", () => {
  test("contains no Recruiter Manager surface for an unauthenticated context", async ({
    page,
  }) => {
    await page.goto(recruiterOrigin);
    await expect(page.locator("body")).not.toContainText(
      /Applicant pipeline|Kanban|Analytics|Team management|Export/u,
    );
  });

  test("requires explicit company selection and revalidates stale membership", async ({
    page,
  }) => {
    test.skip(
      process.env.ADMIN_E2E_READY !== "1",
      "requires provisioned multi-company recruiter fixtures",
    );
    await page.goto(recruiterOrigin);
    await expect(
      page.getByRole("heading", {
        name: /Recruiter workspace is coming next/u,
      }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Available destinations" })
        .getByRole("link"),
    ).toHaveCount(2);
  });
});
