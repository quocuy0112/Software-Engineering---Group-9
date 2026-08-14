import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("in-app notification architecture", () => {
  it("keeps policy and persistence server-only behind account boundaries", () => {
    expect(read("src/backend/notifications/event-policy.ts")).toMatch(
      /^import "server-only";/u,
    );
    expect(
      read(
        "src/backend/repositories/notifications/prisma-notification-repository.ts",
      ),
    ).toMatch(/^import "server-only";/u);
    for (const route of [
      "src/app/api/notifications/route.ts",
      "src/app/api/notifications/unread-count/route.ts",
      "src/app/api/notifications/read-all/route.ts",
      "src/app/api/notifications/contexts/read/route.ts",
    ]) {
      expect(read(route)).toContain("requireAccountRequest");
    }
  });

  it("does not add a notification socket transport or alter email templates", () => {
    const connection = read(
      "src/frontend/features/notifications/client/use-notifications.ts",
    );
    expect(connection).not.toContain("socket.io");
    expect(connection).toContain("4_000");
  });

  it("keeps administrator notification mutations behind the administrator boundary", () => {
    for (const route of [
      "src/app/api/admin/notifications/route.ts",
      "src/app/api/admin/notifications/[notificationId]/read/route.ts",
      "src/app/api/admin/notifications/read-all/route.ts",
    ]) {
      expect(read(route)).toContain("AdminRequestBoundary");
      expect(read(route)).not.toContain("requireAccountRequest");
    }
  });
});
