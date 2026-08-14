import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("notification route contracts", () => {
  it("uses no-store account boundaries and mutation CSRF enforcement", () => {
    const list = readFileSync("src/app/api/notifications/route.ts", "utf8");
    const count = readFileSync(
      "src/app/api/notifications/unread-count/route.ts",
      "utf8",
    );
    const read = readFileSync(
      "src/app/api/notifications/[notificationId]/read/route.ts",
      "utf8",
    );
    const readAll = readFileSync(
      "src/app/api/notifications/read-all/route.ts",
      "utf8",
    );
    expect(list).toContain("notificationListQuerySchema.parse");
    expect(count).toContain("notificationUnreadCountSchema.parse");
    expect(read).toContain("{ mutation: true }");
    expect(readAll).toContain("{ mutation: true }");
  });
});
