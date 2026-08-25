import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readStyle = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("candidate and recruiter workspace theme colors", () => {
  it("defines adaptive foregrounds for brand and semantic fills", () => {
    const tokens = readStyle("src/frontend/styles/tokens.css");

    expect(tokens).toContain(':root[data-theme="dark"]');
    expect(tokens).toContain("--sh-color-on-brand:");
    expect(tokens).toContain("--sh-color-on-success:");
    expect(tokens).toContain("--sh-color-on-warning:");
    expect(tokens).toContain("--sh-color-on-error:");
    expect(tokens).toContain("--sh-color-focus-ring:");
  });

  it("keeps recruiter-only palettes scoped and token based", () => {
    const pipeline = readStyle("src/frontend/styles/recruitment-pipeline.css");
    const team = readStyle(
      "src/frontend/features/recruiter-workspace/company-team-screen.module.css",
    );
    const invitation = readStyle(
      "src/app/recruiter/company-invitation/company-invitation.module.css",
    );
    const workspace = readStyle(
      "src/frontend/styles/recruiter-workspace-full.css",
    );

    expect(pipeline).toContain(
      ".recruiter-pipeline-page {\n  --ink: var(--sh-color-text-primary);",
    );
    expect(pipeline).not.toMatch(/:root\s*{\s*--ink:/);
    expect(team).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(invitation).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(workspace).toContain("background: var(--sh-color-surface-tinted);");
  });

  it("maps candidate applications, CV review, jobs, and matching to shared tokens", () => {
    const applications = readStyle(
      "src/frontend/features/candidate-applications/styles/application-workflow.css",
    );
    const cvReview = readStyle(
      "src/app/(workspace)/profile/cv-imports/[uploadId]/review/page.module.css",
    );
    const jobs = readStyle("src/frontend/features/jobs/styles/job-board.css");
    const privateMatch = readStyle(
      "src/frontend/features/private-cv-match/styles/private-cv-match.css",
    );

    expect(applications).toContain("color: var(--sh-color-on-success);");
    expect(applications).toContain(
      ':root[data-theme="dark"] :is(.application-ui, .candidate-application-flow)',
    );
    expect(cvReview).toContain("--cv-card: var(--sh-color-surface-card);");
    expect(jobs).toContain(
      "--job-detail-accent: var(--sh-color-brand-primary);",
    );
    expect(privateMatch).toContain(
      ':root[data-theme="dark"] .private-match-setup-page',
    );
  });
});
