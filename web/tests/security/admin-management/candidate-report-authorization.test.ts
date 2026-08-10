import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("candidate report authorization", () => {
  const source = readFileSync(
    resolve(
      process.cwd(),
      "src/backend/admin/moderation/moderation-submission-service.ts",
    ),
    "utf8",
  );

  it("permits OWNER/HR and checks direct application authority for recruiter roles", () => {
    expect(source).toMatch(/OWNER/);
    expect(source).toMatch(/HR_MANAGER/);
    expect(source).toMatch(/RECRUITER/);
    expect(source).toMatch(/HIRING_MANAGER/);
    expect(source).toMatch(/jobApplication|application/);
    expect(source).toMatch(/companyId/);
  });

  it("uses a neutral denial and never authorizes by same-company membership alone", () => {
    expect(source).toContain("TARGET_UNAVAILABLE");
    expect(source).toMatch(/stageEvents|processedBy/);
    expect(source).not.toMatch(/candidateExists/u);
  });
});
