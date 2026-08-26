import { readFile } from "node:fs/promises";
import { glob } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("submitted candidate boundaries", () => {
  it("keeps ranking and score behavior out of the Group 1 list", async () => {
    const source = await readFile(
      resolve(process.cwd(), "src/frontend/features/recruiter-applications/submitted-candidates-list.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/aiMatchScore|finalScore|ranking|scoreFilter/i);
    expect(source).toMatch(/Scores are not part of this view/);
  });
});

describe("recruiter application authorization boundaries", () => {
  it("keeps canonical job resolution centralized", async () => {
    const candidates: string[] = [];
    for (const pattern of [
      "src/backend/applications/**/*.{ts,tsx}",
      "src/backend/scoring/**/*.{ts,tsx}",
      "src/app/api/recruiter/jobs/**/applications/**/*.{ts,tsx}",
    ]) {
      for await (const path of glob(pattern)) candidates.push(path);
    }
    for (const path of candidates) {
      const normalizedPath = path.replaceAll("\\", "/");
      if (
        normalizedPath.endsWith(
          "backend/applications/authorization/recruiter-application-authorization.ts",
        )
      ) {
        continue;
      }
      const source = await readFile(resolve(process.cwd(), path), "utf8");
      expect(source, path).not.toContain("jobPostReviewAggregate.find");
      expect(source, path).not.toContain("authorizeLegacyRecruiterJobs");
    }
  });

  it("requires scoring and document application access to use centralized authorization", async () => {
    const consumers = [
      "src/backend/applications/services/open-application-document.ts",
      "src/backend/scoring/services/scoring-detail-service.ts",
      "src/backend/scoring/services/application-scoring-service.ts",
      "src/backend/scoring/services/ai-retry-service.ts",
      "src/backend/scoring/services/manual-priority-service.ts",
    ];
    for (const path of consumers) {
      const source = await readFile(resolve(process.cwd(), path), "utf8");
      expect(source, path).toContain("authorizeApplication");
    }
  });
});

describe("pipeline implementation boundaries", () => {
  it("keeps stage persistence and notification intent in the single authority", async () => {
    for await (const path of glob("src/backend/applications/**/*.{ts,tsx}")) {
      const source = await readFile(resolve(process.cwd(), path), "utf8");
      expect(source, path).not.toContain("applicationStageEvent.create");
      expect(source, path).not.toContain("createInAppNotification");
    }
  });

  it("keeps DnD at the recruiter presentation boundary and prevents private logging", async () => {
    for await (const path of glob("src/**/*.{ts,tsx}")) {
      const source = await readFile(resolve(process.cwd(), path), "utf8");
      if (source.includes("@dnd-kit/core")) {
        expect(path.replaceAll("\\", "/")).toMatch(/frontend\/features\/recruiter-applications\/(recruitment-pipeline-(?:board|card|column))\.tsx$/u);
      }
      expect(source, path).not.toMatch(/console\.(?:log|info|warn|error)\([^)]*internalNote/iu);
    }
  });
});
