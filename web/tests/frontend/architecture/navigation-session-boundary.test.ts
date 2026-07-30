import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("navigation session boundary", () => {
  it("authenticates the workspace once at the server layout boundary", async () => {
    const layout = await readFile("src/app/(workspace)/layout.tsx", "utf8");
    expect(layout).toContain("getWorkspaceContext");
    const context = await readFile(
      "src/backend/auth/get-workspace-context.ts",
      "utf8",
    );
    expect(context).toContain("requireSession");
    expect(layout).toContain("WorkspaceShell");
    expect(layout).not.toMatch(/localStorage|sessionStorage|fetch\(/);
  });

  it("keeps child pages free of duplicated shell markup and session fetches", async () => {
    const pages = [
      "src/app/(workspace)/dashboard/page.tsx",
      "src/app/(workspace)/settings/security/page.tsx",
      "src/app/(workspace)/settings/sessions/page.tsx",
    ];
    for (const path of pages) {
      const source = await readFile(path, "utf8");
      expect(source).not.toMatch(
        /requireSession|WorkspaceShell|localStorage|sessionStorage/,
      );
    }
  });

  it("keeps workspace navigation presentation-only and non-persistent", async () => {
    const shell = await readFile(
      "src/frontend/features/dashboard/components/workspace-shell.tsx",
      "utf8",
    );
    const navigation = await readFile(
      "src/frontend/features/dashboard/components/workspace-navigation.tsx",
      "utf8",
    );
    expect(navigation).toContain("usePathname");
    expect(navigation).toContain("aria-expanded");
    expect(shell).toContain("/api/identity/logout");
    expect(shell + navigation).not.toMatch(
      /localStorage|sessionStorage|sessionToken|sessionId/,
    );
  });
});
