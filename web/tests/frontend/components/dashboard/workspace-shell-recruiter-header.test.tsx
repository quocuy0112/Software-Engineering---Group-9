import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("workspace shell recruiter header composition", () => {
  it("keeps theme, compact profile, and action order", async () => {
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
    expect(shell).toContain("greetingName || workspaceProfile.name");
    expect(shell).toContain("title={accountTitle}");
    expect(shell).not.toContain("<small>{workspaceProfile.email}</small>");
    expect(shell).toContain("initialRecruiterStatus");
  });
});
