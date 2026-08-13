import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("administrator messaging-report security", () => {
  it("requires fresh sensitive proof for detail and commands", () => {
    const detail = readFileSync(
      "src/app/api/admin/messaging-reports/[reportId]/route.ts",
      "utf8",
    );
    const command = readFileSync(
      "src/app/api/admin/messaging-reports/[reportId]/[action]/route.ts",
      "utf8",
    );
    expect(detail).toContain("sensitive: true");
    expect(command).toContain("sensitive: true");
  });

  it("inherits private no-store and content-free error responses", () => {
    const http = readFileSync(
      "src/backend/admin/http/admin-route.ts",
      "utf8",
    );
    expect(http).toContain('"cache-control": "no-store, max-age=0"');
    expect(http).toContain('"x-content-type-options": "nosniff"');
    expect(http).not.toMatch(/normalizedDetail|message\.content/u);
  });
});
