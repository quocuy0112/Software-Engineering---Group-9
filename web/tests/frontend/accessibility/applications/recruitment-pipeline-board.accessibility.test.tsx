import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("pipeline accessibility boundary", () => {
  it("provides labelled list/kanban switching, columns, load-more, and non-color state copy", () => {
    const workspace = readFileSync("src/frontend/features/recruiter-applications/recruiter-candidate-workspace.tsx", "utf8");
    const column = readFileSync("src/frontend/features/recruiter-applications/recruitment-pipeline-column.tsx", "utf8");
    expect(workspace).toMatch(/aria-label=.*view/i);
    expect(column).toContain('role="region"');
    expect(column).toMatch(/Load more/i);
    expect(column).toMatch(/No applications/i);
  });
});
