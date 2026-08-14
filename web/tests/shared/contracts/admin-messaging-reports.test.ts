import { describe, expect, it } from "vitest";
import {
  adminMessagingReportListItemSchema,
  adminMessagingReportNoteCommandSchema,
} from "@/shared/contracts/admin/messaging-reports";

const safeItem = {
  id: "report-1",
  reporterAccountId: "reporter-1",
  reporterDisplayName: "Reporter",
  targetAccountId: "target-1",
  targetDisplayName: "Target",
  targetType: "CONVERSATION",
  category: "OTHER",
  state: "PENDING_REVIEW",
  assignedAdministratorId: null,
  evidenceAvailable: true,
  createdAt: new Date(0).toISOString(),
  version: 1,
};

describe("administrator messaging-report contracts", () => {
  it("accepts the metadata-only list projection", () => {
    expect(adminMessagingReportListItemSchema.parse(safeItem)).toEqual(
      safeItem,
    );
  });

  it("rejects report detail and message content in list rows", () => {
    expect(() =>
      adminMessagingReportListItemSchema.parse({
        ...safeItem,
        normalizedDetail: "private detail",
        content: "private message",
        conversationId: "conversation-1",
      }),
    ).toThrow();
  });

  it("normalizes and bounds private notes", () => {
    expect(
      adminMessagingReportNoteCommandSchema.parse({
        confirmation: true,
        note: "  Review <b>evidence</b>.  ",
      }).note,
    ).toBe("Review evidence.");
    expect(() =>
      adminMessagingReportNoteCommandSchema.parse({
        confirmation: true,
        note: "x".repeat(2001),
      }),
    ).toThrow();
  });
});
