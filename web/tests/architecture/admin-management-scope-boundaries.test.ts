import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

function sources(directory: string): string {
  return readdirSync(directory)
    .map((name) => {
      const path = join(directory, name);
      return statSync(path).isDirectory()
        ? sources(path)
        : /[.](?:ts|tsx)$/u.test(path)
          ? readFileSync(path, "utf8")
          : "";
    })
    .join("\n");
}

describe("Feature 006 out-of-scope boundary", () => {
  const admin = sources(resolve(process.cwd(), "src/frontend/features/admin"));
  const recruiter = sources(
    resolve(process.cwd(), "src/frontend/features/recruiter-entitlement"),
  );
  const recruiterBoundary = readFileSync(
    resolve(
      process.cwd(),
      "src/backend/admin/memberships/recruiter-entitlement-service.ts",
    ),
    "utf8",
  );

  it("introduces no deletion, grant-management, export, AI decision, or automated enforcement UI", () => {
    expect(admin).not.toMatch(
      /delete (?:account|company)|grant administrator|export (?:csv|data)|ai (?:moderation|verification)|auto(?:matic)? enforcement/iu,
    );
    expect(admin).toMatch(/deleteMany:\s*unsupported/u);
  });

  it("limits recruiter origin to two hand-off destinations", () => {
    expect(recruiterBoundary).toContain("Candidate Dashboard");
    expect(recruiterBoundary).toContain("Employer Verification");
    expect(recruiter).not.toMatch(
      /kanban|applicant pipeline|analytics|team management|job editor/iu,
    );
  });
});
