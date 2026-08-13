import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("support privacy", () => {
  it("never exposes ordinary message models through support routes", () => {
    const requesterRoutes =
      readFileSync("src/app/api/support/cases/route.ts", "utf8") +
      readFileSync("src/app/api/support/cases/[caseId]/route.ts", "utf8");
    const adminRoutes =
      readFileSync("src/app/api/admin/support-cases/route.ts", "utf8") +
      readFileSync("src/app/api/admin/support-cases/[caseId]/route.ts", "utf8");
    expect(requesterRoutes + adminRoutes).not.toMatch(
      /MessagingConversation|MessagingMessage|messaging\/services/iu,
    );
  });
});
