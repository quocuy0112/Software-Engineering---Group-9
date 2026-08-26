import { expect, test, type Page } from "@playwright/test";
import { clearSuccessfulLoginRateLimit } from "../fixtures/rate-limit";
import {
  runRecruitmentPipelineKanbanE2EControl,
  type RecruitmentPipelineKanbanE2EFixture,
} from "../../../helpers/recruitment-pipeline-kanban/recruitment-pipeline-kanban-e2e-control";

const password = "Feature 019 recruiter 2026!";
let fixture: RecruitmentPipelineKanbanE2EFixture;

function applicationCard(page: Page, applicationId: string) {
  return page.locator(`[data-application-id="${applicationId}"]`);
}

async function signInRecruiter(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(fixture.recruiter.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/u, { timeout: 30_000 });
  await clearSuccessfulLoginRateLimit(fixture.recruiter.email);
}

async function openPipeline(page: Page, requestedJobId: string) {
  await page.goto(`/recruiter/candidates/${requestedJobId}`);
  await expect(page.getByRole("button", { name: "List" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Kanban" }).click();
  await expect(page.getByRole("region", { name: "Applied" })).toBeVisible();
}

async function submitStageChange(
  page: Page,
  applicationId: string,
  targetStage: string,
  actionName = "Change Stage",
) {
  const card = applicationCard(page, applicationId);
  await card.locator("strong").first().click();
  await card.getByRole("button", { name: "Change Stage" }).click();
  const dialog = page.getByRole("dialog", { name: /Change Stage for/u });
  await dialog.getByLabel("Destination stage").selectOption(targetStage);
  await dialog.getByRole("button", { name: actionName }).click();
}

async function pointerDragToStage(
  page: Page,
  applicationId: string,
  stage: string,
) {
  const card = applicationCard(page, applicationId);
  const handle = card.getByRole("button", {
    name: /Drag .* to another stage/u,
  });
  const target = page.getByRole("region", { name: stage });
  const sourceBox = await handle.boundingBox();
  const targetBox = await target.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + 18);
  await page.mouse.down();
  await page.mouse.move(
    sourceBox!.x + sourceBox!.width / 2 + 12,
    sourceBox!.y + 38,
    { steps: 3 },
  );
  await page.mouse.move(
    targetBox!.x + targetBox!.width / 2,
    targetBox!.y + Math.min(targetBox!.height / 2, 120),
    { steps: 12 },
  );
  await page.mouse.up();
}

async function expectReadablePipelineTheme(page: Page, expectedTheme: string) {
  const result = await page.evaluate(() => {
    function parse(color: string) {
      const values =
        color
          .match(/[\d.]+/gu)
          ?.slice(0, 3)
          .map(Number) ?? [];
      return values.length === 3 ? values : null;
    }
    function luminance(values: number[]) {
      const channels = values.map((value) => {
        const channel = value / 255;
        return channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    }
    function contrast(element: Element, background: Element) {
      const foreground = parse(getComputedStyle(element).color);
      const surface = parse(getComputedStyle(background).backgroundColor);
      if (!foreground || !surface) return 0;
      const first = luminance(foreground);
      const second = luminance(surface);
      return (
        (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
      );
    }
    const column = document.querySelector(".pipeline-column");
    const card = document.querySelector(".pipeline-card");
    const title = column?.querySelector("h2");
    const candidate = card?.querySelector("strong");
    const metadata = card?.querySelector("span");
    const button = card?.querySelector("button");
    if (!column || !card || !title || !candidate || !metadata || !button) {
      throw new Error("Pipeline theme elements are unavailable");
    }
    return {
      theme: document.documentElement.dataset.theme,
      contrasts: [
        contrast(title, column),
        contrast(candidate, card),
        contrast(metadata, card),
        contrast(button, button),
      ],
    };
  });
  expect(result.theme).toBe(expectedTheme);
  for (const contrast of result.contrasts)
    expect(contrast).toBeGreaterThanOrEqual(4.5);
}

test.describe("Recruitment Pipeline Kanban Board", () => {
  test.beforeEach(async () => {
    fixture =
      await runRecruitmentPipelineKanbanE2EControl<RecruitmentPipelineKanbanE2EFixture>(
        "create",
      );
  });

  test.afterEach(async () => {
    if (fixture) {
      await runRecruitmentPipelineKanbanE2EControl("delete", {
        companyId: fixture.companyId,
      });
    }
  });

  test("selects a recruiter job and supports pointer and keyboard stage movement", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    await signInRecruiter(page);

    await page.goto("/recruiter/candidates");
    await page
      .getByPlaceholder("Search by role, company, or department")
      .fill(fixture.jobs.active.title);
    await page
      .locator(
        `a[href="/recruiter/candidates/${fixture.jobs.active.requestedId}"]`,
      )
      .getByText("Review candidates", { exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(
        `/recruiter/candidates/${fixture.jobs.active.requestedId}$`,
        "u",
      ),
    );
    await expect(page.getByRole("button", { name: "List" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByRole("button", { name: "Kanban" }).click();
    await expect(
      applicationCard(page, fixture.applications.ordinary.id),
    ).toBeVisible();

    const stageOrder = await page
      .getByRole("region")
      .evaluateAll((regions) =>
        regions.map((region) => region.querySelector("h2")?.textContent),
      );
    expect(stageOrder).toEqual([
      "Applied",
      "Viewed",
      "Shortlisted",
      "Interviewing",
      "Offered",
      "Hired",
      "Offer Declined",
      "Rejected",
      "Waitlisted",
    ]);
    const desktopColumns = await page
      .locator(".recruitment-pipeline__columns")
      .evaluate(
        (element) =>
          getComputedStyle(element).gridTemplateColumns.split(" ").length,
      );
    expect(desktopColumns).toBe(
      testInfo.project.name === "desktop-chromium" ? 3 : 1,
    );
    await expectReadablePipelineTheme(page, "light");
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await expectReadablePipelineTheme(page, "dark");
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await expectReadablePipelineTheme(page, "light");

    if (testInfo.project.name === "desktop-chromium") {
      await pointerDragToStage(
        page,
        fixture.applications.ordinary.id,
        "Viewed",
      );
      await expect(page.getByRole("dialog")).toHaveCount(0);
    } else {
      await submitStageChange(page, fixture.applications.ordinary.id, "VIEWED");
    }
    await expect(
      page.getByText(
        `${fixture.applications.ordinary.candidateName} moved successfully.`,
      ),
    ).toBeAttached();
    await expect(
      page
        .getByRole("region", { name: "Viewed" })
        .locator(`[data-application-id="${fixture.applications.ordinary.id}"]`),
    ).toBeVisible();

    const keyboardCard = applicationCard(
      page,
      fixture.applications.ordinary.id,
    );
    await keyboardCard.locator("strong").first().click();
    const keyboardControl = keyboardCard.getByRole("button", {
      name: "Change Stage",
    });
    await keyboardControl.focus();
    await page.keyboard.press("Enter");
    const keyboardDialog = page.getByRole("dialog", {
      name: `Change Stage for ${fixture.applications.ordinary.candidateName}`,
    });
    const destination = keyboardDialog.getByLabel("Destination stage");
    await destination.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(destination).toHaveValue("SHORTLISTED");
    const keyboardSubmit = keyboardDialog.getByRole("button", {
      name: "Change Stage",
    });
    await keyboardSubmit.focus();
    await page.keyboard.press("Enter");
    const movedKeyboardCard = applicationCard(
      page,
      fixture.applications.ordinary.id,
    );
    await expect(movedKeyboardCard).toBeVisible();
    await expect(movedKeyboardCard).toBeFocused();
  });

  test("confirms rejection and Hired decisions, including on a Closed job", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await signInRecruiter(page);
    await openPipeline(page, fixture.jobs.active.requestedId);
    const rejectionCard = applicationCard(
      page,
      fixture.applications.rejection.id,
    );
    if (page.viewportSize()?.width && page.viewportSize()!.width > 700) {
      await pointerDragToStage(
        page,
        fixture.applications.rejection.id,
        "Rejected",
      );
    } else {
      await rejectionCard.locator("strong").first().click();
      await rejectionCard.getByRole("button", { name: "Change Stage" }).click();
    }
    const rejectionDialog = page.getByRole("dialog", {
      name: `Change Stage for ${fixture.applications.rejection.candidateName}`,
    });
    if (page.viewportSize()?.width && page.viewportSize()!.width <= 700) {
      await rejectionDialog
        .getByLabel("Destination stage")
        .selectOption("REJECTED");
    } else {
      await expect(rejectionDialog.getByLabel("Destination stage")).toHaveValue(
        "REJECTED",
      );
    }
    await expect(
      rejectionDialog.getByRole("button", { name: "Confirm rejection" }),
    ).toBeDisabled();
    await rejectionDialog
      .getByLabel("Rejection reason")
      .selectOption("POSITION_FILLED");
    await rejectionDialog
      .getByLabel("Private recruiter note (optional)")
      .fill("Internal E2E note that must remain private.");
    await expect(rejectionDialog).toContainText(
      "Never shared with the candidate.",
    );
    await rejectionDialog
      .getByRole("button", { name: "Confirm rejection" })
      .click();
    await expect(
      page
        .getByRole("region", { name: "Rejected" })
        .locator(
          `[data-application-id="${fixture.applications.rejection.id}"]`,
        ),
    ).toBeVisible();

    await openPipeline(page, fixture.jobs.closed.requestedId);
    await expect(page.getByText(/Closed to new applications/u)).toBeVisible();
    const hiredCard = applicationCard(page, fixture.applications.hired.id);
    await hiredCard.locator("strong").first().click();
    await hiredCard.getByRole("button", { name: "Change Stage" }).click();
    const hiredDialog = page.getByRole("dialog", {
      name: `Change Stage for ${fixture.applications.hired.candidateName}`,
    });
    await hiredDialog.getByLabel("Destination stage").selectOption("HIRED");
    await expect(hiredDialog).toContainText(
      "Hiring must be explicitly confirmed by an authorized recruiter-side user.",
    );
    await hiredDialog.getByRole("button", { name: "Confirm hiring" }).click();
    await expect(
      page
        .getByRole("region", { name: "Hired" })
        .locator(`[data-application-id="${fixture.applications.hired.id}"]`),
    ).toBeVisible();
  });

  test("reconciles a stale decision and clears data after authorization loss", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await signInRecruiter(page);
    await openPipeline(page, fixture.jobs.active.requestedId);
    await expect(
      applicationCard(page, fixture.applications.stale.id),
    ).toBeVisible();
    await runRecruitmentPipelineKanbanE2EControl("advance-stale", {
      recruiterUserId: fixture.recruiter.userId,
      requestedJobId: fixture.jobs.active.requestedId,
      applicationId: fixture.applications.stale.id,
    });
    await submitStageChange(page, fixture.applications.stale.id, "SHORTLISTED");
    await expect(
      page.getByText("This application changed. Refresh it and try again."),
    ).toBeAttached();
    await expect(
      page
        .getByRole("region", { name: "Viewed" })
        .locator(`[data-application-id="${fixture.applications.stale.id}"]`),
    ).toBeVisible();

    await runRecruitmentPipelineKanbanE2EControl("revoke-membership", {
      membershipId: fixture.membershipId,
    });
    await submitStageChange(
      page,
      fixture.applications.unavailable.id,
      "VIEWED",
    );
    await expect(
      page.getByRole("alert").filter({
        hasText: "The recruitment pipeline is unavailable.",
      }),
    ).toBeVisible();
    await expect(page.locator("[data-application-id]")).toHaveCount(0);
  });
});
