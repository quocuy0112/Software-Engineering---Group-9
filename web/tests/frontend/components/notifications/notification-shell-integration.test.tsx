import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("notification shell integration", () => {
  it("mounts the unified center in workspace and administrator shells", () => {
    const workspace = readFileSync(
      "src/frontend/features/dashboard/components/workspace-shell.tsx",
      "utf8",
    );
    const adminBar = readFileSync(
      "src/frontend/features/admin/layout/admin-app-bar.tsx",
      "utf8",
    );
    const adminLayout = readFileSync(
      "src/frontend/features/admin/layout/admin-layout.tsx",
      "utf8",
    );
    expect(workspace).toContain("<NotificationCenter");
    expect(adminBar).toContain("<NotificationCenter");
    expect(adminLayout).toContain("appBar={AdminAppBar}");
  });
});
