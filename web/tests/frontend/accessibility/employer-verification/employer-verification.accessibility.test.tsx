import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("employer verification accessibility", () => {
  const page = readFileSync(
    "src/frontend/features/employer-verification/employer-verification-page.tsx",
    "utf8",
  );
  const styles = readFileSync(
    "src/frontend/features/employer-verification/employer-verification-page.module.css",
    "utf8",
  );

  it("keeps semantic sections, labelled fields, and text status cues", () => {
    expect(page.match(/<section/gu)?.length).toBeGreaterThanOrEqual(5);
    expect(page.match(/<label/gu)?.length).toBeGreaterThanOrEqual(12);
    expect(page).toContain('aria-label="Verify company email"');
    expect(page).toContain('aria-describedby="tax-help"');
    expect(page).toContain("this phone is unverified");
  });

  it("preserves narrow-screen layout and visible keyboard focus", () => {
    expect(styles).toContain("@media (max-width:");
    expect(styles).toContain(":focus-visible");
    expect(styles).toMatch(/grid-template-columns:\s*1fr/gu);
  });
});
