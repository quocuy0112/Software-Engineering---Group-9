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

  it("uses shared theme tokens for board, card, controls, and dialog surfaces", () => {
    const styles = readFileSync(
      "src/frontend/styles/recruiter-workspace-full.css",
      "utf8",
    );

    expect(styles).toMatch(
      /\.pipeline-column\s*\{[^}]*background:\s*var\(--sh-color-surface-subtle\)/u,
    );
    expect(styles).toMatch(
      /\.pipeline-card\s*\{[^}]*background:\s*var\(--sh-color-surface-card\)/u,
    );
    expect(styles).toMatch(
      /\.pipeline-dialog\s*\{[^}]*background:\s*var\(--sh-color-surface-card\)/u,
    );
    expect(styles).toMatch(
      /\.pipeline-card__actions\s+(?:button|a)[^{]*\{[^}]*color:\s*var\(--sh-color-text-primary\)/u,
    );
    expect(styles).toContain("var(--sh-color-border-focus)");
    expect(styles).not.toMatch(
      /\.pipeline-(?:column|card)\s*\{[^}]*(?:#f6f7f9|#fff|#cbd1da|#d7dbe2)/u,
    );
  });
});
