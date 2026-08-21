import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const featureRoot = resolve(
  process.cwd(),
  "src/frontend/features/private-cv-match",
);

describe("private CV match accessibility and fallback affordances", () => {
  it("contains visible focus, responsive stacking, and non-color progress semantics", async () => {
    const css = await readFile(
      resolve(featureRoot, "styles/private-cv-match.css"),
      "utf8",
    );
    expect(css).toMatch(/:focus-visible/u);
    expect(css).toMatch(/@media \(max-width: 768px\)/u);
    expect(css).toContain(".private-match-visually-hidden");
    expect(css).toMatch(
      /@media \(max-width: 768px\)[\s\S]*?\.private-match-columns\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/u,
    );
    expect(css).toMatch(
      /\.private-match-report-summary\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;/u,
    );
    expect(css).toMatch(
      /\.private-match-evidence-list\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/u,
    );
  });

  it("keeps polling and limited-mode labels accessible in the source UI", async () => {
    const page = await readFile(
      resolve(featureRoot, "components/private-match-page-client.tsx"),
      "utf8",
    );
    const report = await readFile(
      resolve(featureRoot, "components/private-match-report.tsx"),
      "utf8",
    );
    const setup = await readFile(
      resolve(featureRoot, "components/private-match-setup.tsx"),
      "utf8",
    );
    const list = await readFile(
      resolve(featureRoot, "components/private-match-list.tsx"),
      "utf8",
    );
    const deletion = await readFile(
      resolve(featureRoot, "components/private-match-delete-control.tsx"),
      "utf8",
    );
    const client = await readFile(
      resolve(featureRoot, "client/use-private-cv-match.ts"),
      "utf8",
    );
    const copy = await readFile(
      resolve(featureRoot, "i18n/private-match-copy.ts"),
      "utf8",
    );
    expect(page).toContain('aria-busy="true"');
    expect(page).toContain('aria-live="polite"');
    expect(copy).toContain("AI evaluation unavailable");
    expect(copy).toContain("Final score: not calculated");
    expect(copy).toContain("Apply now");
    expect(copy).toContain("Analyze my CV");
    expect(copy).toContain("Sensitive personal attributes are excluded");
    expect(copy).toContain("Saved CV match checks");
    expect(copy).toContain("Expires in");
    expect(report).toContain("useWorkspaceLocale");
    expect(setup).toContain("useWorkspaceLocale");
    expect(list).toContain("useWorkspaceLocale");
    expect(deletion).toContain('role="dialog"');
    expect(copy).toContain("physically deleted within 30 days");
    expect(client).toContain("document.visibilityState");
    expect(client).toContain("usePrivateCvMatchList");
  });
});
