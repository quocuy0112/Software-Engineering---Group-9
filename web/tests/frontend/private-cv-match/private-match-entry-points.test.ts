import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = resolve(process.cwd(), "src");

describe("candidate CV Match Check entry points", () => {
  it("exposes the feature from the candidate dashboard and Jobs navigation", async () => {
    const [dashboard, navigation, jobsWorkspace, suggestedJobsRoute] =
      await Promise.all([
        readFile(
          resolve(
            sourceRoot,
            "frontend/features/dashboard/components/dashboard-view.tsx",
          ),
          "utf8",
        ),
        readFile(
          resolve(
            sourceRoot,
            "frontend/features/dashboard/components/workspace-navigation.tsx",
          ),
          "utf8",
        ),
        readFile(
          resolve(
            sourceRoot,
            "frontend/features/jobs/components/jobs-workspace.tsx",
          ),
          "utf8",
        ),
        readFile(resolve(sourceRoot, "app/jobs/matches/page.tsx"), "utf8"),
      ]);

    expect(dashboard).toContain('href="/cv-match-check"');
    expect(dashboard).toContain("matchTitle");
    expect(navigation).toContain('href: "/cv-match-check"');
    expect(navigation).toContain("CV Match Check");
    expect(jobsWorkspace).toContain('href: "/jobs/matches"');
    expect(jobsWorkspace).toContain("Suggested Jobs");
    expect(navigation).toContain("Suggested Jobs");
    expect(suggestedJobsRoute).toContain("SuggestedJobsPage");
    expect(suggestedJobsRoute).toContain("suggestedJobsForSnapshot");
  });

  it("offers a private check from active candidate job details and preselects that job", async () => {
    const [
      jobDetail,
      matchesRoute,
      setupRoute,
      privateMatchService,
      setup,
      matchLayout,
    ] = await Promise.all([
      readFile(
        resolve(
          sourceRoot,
          "frontend/features/jobs/components/job-detail-redesign.tsx",
        ),
        "utf8",
      ),
      readFile(
        resolve(sourceRoot, "app/(workspace)/cv-match-check/page.tsx"),
        "utf8",
      ),
      readFile(
        resolve(sourceRoot, "app/(workspace)/cv-match-check/new/page.tsx"),
        "utf8",
      ),
      readFile(
        resolve(
          sourceRoot,
          "backend/private-cv-match/private-cv-match-service.ts",
        ),
        "utf8",
      ),
      readFile(
        resolve(
          sourceRoot,
          "frontend/features/private-cv-match/components/private-match-setup.tsx",
        ),
        "utf8",
      ),
      readFile(
        resolve(sourceRoot, "app/(workspace)/cv-match-check/layout.tsx"),
        "utf8",
      ),
    ]);

    expect(jobDetail).toContain("Check CV fit privately");
    expect(jobDetail).toContain("/cv-match-check/new?jobId=");
    expect(matchesRoute).toContain("PrivateMatchList");
    expect(setupRoute).toContain("initialJobId={requestedJobId}");
    expect(setupRoute).toContain("findEligiblePrivateMatchJob");
    expect(setupRoute).toContain("listEligiblePrivateMatchJobs");
    expect(setupRoute).not.toContain("readJobWorkspaceSnapshot");
    expect(privateMatchService).toContain("findEligiblePrivateMatchJob");
    expect(privateMatchService).toContain("approvedAt: { not: null }");
    expect(privateMatchService).toContain(
      'verificationState: { not: "INACTIVE" as const }',
    );
    expect(setup).toContain("initialJobId");
    expect(setup).toContain("requestedJobIsUnavailable");
    expect(setup).not.toContain(
      "jobs.find((job) => job.jobId === jobId) ?? jobs[0]",
    );
    expect(matchLayout).toContain("AppProviders");
    expect(matchLayout).toContain("<AppProviders>{children}</AppProviders>");
  });
});
