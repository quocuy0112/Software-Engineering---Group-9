import { expect, test } from "@playwright/test";

test.describe("Candidate Company and Team Applications", () => {
  test.skip(
    process.env.RUN_COMPANY_TEAM_APPLICATIONS_E2E !== "1",
    "Requires a seeded authenticated Candidate/Owner environment.",
  );

  test("candidate can discover a company, distinguish team applications, and open ordinary jobs", async ({
    page,
  }) => {
    await page.goto("/company");
    await expect(
      page.getByRole("heading", { name: /Companies|Công ty/u }),
    ).toBeVisible();

    const companyLink = page
      .getByRole("link", { name: /View company|Xem công ty/u })
      .first();
    await expect(companyLink).toBeVisible();
    await companyLink.click();
    await expect(
      page.getByRole("heading", { name: /Open positions|Vị trí đang tuyển/u }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /Join the company team|Gia nhập đội ngũ công ty/u,
      }),
    ).toBeVisible();
  });

  test("candidate can track team application state separately from ordinary applications", async ({
    page,
  }) => {
    await page.goto("/jobs/applied/team");
    await expect(
      page.getByRole("heading", {
        name: /Team Applications|Ứng tuyển đội ngũ/u,
      }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("link", { name: /Browse companies|Xem công ty/u })
        .or(page.getByRole("button", { name: "Refresh" })),
    ).toBeVisible();
  });
});
