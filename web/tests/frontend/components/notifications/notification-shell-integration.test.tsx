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
    const adminApp = readFileSync(
      "src/frontend/features/admin/app/admin-app.tsx",
      "utf8",
    );
    expect(workspace).toContain("<NotificationCenter");
    expect(adminBar).toContain("<AdminNotificationButton");
    expect(adminLayout).toContain("appBar={AdminAppBar}");
    expect(adminApp).toContain('name="notifications"');
    expect(adminApp).toContain("list={AdminNotificationList}");
  });
});
