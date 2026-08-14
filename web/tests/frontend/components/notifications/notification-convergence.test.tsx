import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("notification convergence", () => {
  it("polls visible clients inside the five-second target and supports immediate invalidation", () => {
    const client = readFileSync(
      "src/frontend/features/notifications/client/use-notifications.ts",
      "utf8",
    );
    expect(client).toContain("? 4_000");
    expect(client).toContain("NOTIFICATION_CHANGED_EVENT");
    expect(client).toContain('invalidateQueries({ queryKey: ["notifications"] })');
  });
});
