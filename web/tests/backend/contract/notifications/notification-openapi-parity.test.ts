import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  notificationCategories,
  notificationContextTypes,
  notificationSeverities,
  notificationListQuerySchema,
  notificationContextReadSchema,
} from "@/shared/contracts/notifications";

const contract = readFileSync(
  "../spec-kit/specs/016-inapp-email-notification/contracts/notifications.openapi.yaml",
  "utf8",
);

describe("Feature 016 OpenAPI and Zod parity", () => {
  it("contains every notification endpoint and session-derived CSRF header", () => {
    for (const path of [
      "/api/notifications:",
      "/api/notifications/unread-count:",
      "/api/notifications/{notificationId}/read:",
      "/api/notifications/read-all:",
      "/api/notifications/contexts/read:",
    ])
      expect(contract).toContain(path);
    expect(contract).toContain("name: x-csrf-token");
    expect(contract).not.toContain("csrfProof:");
  });

  it("keeps enum values and bounds represented", () => {
    for (const value of [
      ...notificationCategories,
      ...notificationContextTypes,
      ...notificationSeverities,
    ])
      expect(contract).toContain(value);
    expect(
      notificationListQuerySchema.safeParse({ limit: 51 }).success,
    ).toBe(false);
    expect(
      notificationContextReadSchema.safeParse({
        contextType: "CONVERSATION",
        contextId: "conversation-1",
        secret: "forbidden",
      }).success,
    ).toBe(false);
  });
});
