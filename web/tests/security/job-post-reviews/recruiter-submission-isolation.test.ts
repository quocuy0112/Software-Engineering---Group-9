import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  "src/backend/services/jobs/recruiter-job-posting-data.ts",
  "utf8",
);

describe("Recruiter review submission isolation", () => {
  it("requires an active account, verified company, active qualifying membership", () => {
    for (const marker of [
      'status: "ACTIVE"',
      'state: "ACTIVE"',
      'verificationState: "ACTIVE"',
      "verificationInactiveAt: null",
      '"OWNER", "HR_MANAGER", "RECRUITER", "HIRING_MANAGER"',
      "company.databaseBacked",
    ])
      expect(source).toContain(marker);
  });
});
