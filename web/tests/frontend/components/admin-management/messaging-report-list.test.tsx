import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("messaging report queue", () => {
  it("renders safe metadata columns without protected content fields", () => {
    const source = readFileSync(
      "src/frontend/features/admin/messaging-reports/messaging-report-list.tsx",
      "utf8",
    );
    expect(source).toContain('source="reporterDisplayName"');
    expect(source).toContain('source="targetDisplayName"');
    expect(source).toContain('source="evidenceAvailable"');
    expect(source).not.toMatch(/source="(?:detail|content|conversationId)"/u);
  });
});
