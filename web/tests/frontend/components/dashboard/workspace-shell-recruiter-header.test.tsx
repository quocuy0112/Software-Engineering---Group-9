import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("workspace shell recruiter header composition", () => {
  it("keeps theme, profile, and action order with full profile disclosure", async () => {
    const shell = await readFile(
      resolve(
        process.cwd(),
        "src/frontend/features/dashboard/components/workspace-shell.tsx",
      ),
      "utf8",
    );
    const theme = shell.indexOf("<ThemeToggle");
    const profile = shell.indexOf("workspace-account-chip");
    const action = shell.indexOf("<RecruiterHeaderAction");
    expect(theme).toBeGreaterThan(-1);
    expect(profile).toBeGreaterThan(theme);
    expect(action).toBeGreaterThan(profile);
    expect(shell).toContain("workspaceProfile.email");
    expect(shell).toContain("initialRecruiterStatus");
  });
});
