import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

async function source(path: string) {
  return readFile(resolve(process.cwd(), path), "utf8");
}

describe("candidate application workflow boundaries", () => {
  it("routes every active Apply entry point to the page-based flow", async () => {
    const files = [
      "src/frontend/features/jobs/components/job-card.tsx",
      "src/frontend/features/jobs/components/job-detail-redesign.tsx",
      "src/frontend/features/jobs/components/job-application-form.tsx",
      "src/frontend/features/private-cv-match/components/private-match-report.tsx",
    ];
    for (const file of files) {
      const text = await source(file);
      expect(text).not.toMatch(/apply=true|ApplyFormSection/);
      expect(text).toMatch(/\/apply/);
    }
  });

  it("keeps the candidate tracker repository projection allow-listed", async () => {
    const repository = await source(
      "src/backend/repositories/candidate-applications/prisma-candidate-application-repository.ts",
    );
    expect(repository).not.toMatch(/aiMatchScore|scoringStatus|finalScore|rankPosition|reasonEncrypted|internalNote/i);
  });

  it("exposes Applications as a top-level sidebar destination", async () => {
    const navigation = await source(
      "src/frontend/features/dashboard/components/workspace-navigation.tsx",
    );
    const jobsWorkspace = await source(
      "src/frontend/features/jobs/components/jobs-workspace.tsx",
    );

    expect(navigation).toContain('href: "/jobs/applied"');
    expect(navigation).toContain('icon: "applications"');
    expect(jobsWorkspace).not.toContain('id: "applied"');
  });

  it("records recruiter review when a recruiter opens a new application", async () => {
    const rankingList = await source(
      "src/frontend/features/recruiter-applications/candidate-ranking-list.tsx",
    );
    const drawer = await source(
      "src/frontend/features/recruiter-applications/candidate-score-drawer.tsx",
    );
    expect(rankingList).toContain("acknowledgeCandidateOpened");
    expect(rankingList).toContain("/view");
    expect(rankingList).toContain('method: "POST"');
    expect(drawer).toContain("onApplicationOpened");
  });
});
