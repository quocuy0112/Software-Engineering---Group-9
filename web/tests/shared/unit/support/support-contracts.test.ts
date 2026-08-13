import { describe, expect, it } from "vitest";
import {
  createSupportCaseInputSchema,
  supportCaseDetailSchema,
  supportInvalidationSchema,
} from "@/shared/contracts/support";

describe("support contracts", () => {
  it("normalizes requester text and rejects oversized content", () => {
    const parsed = createSupportCaseInputSchema.parse({
      category: "MESSAGING",
      subject: "  Cannot <b>send</b> messages  ",
      message: "Hello<script>bad()</script>\n\n\nSupport",
      clientOperationId: "1e40dc51-b549-4a71-a959-f7415fe594e0",
    });
    expect(parsed.subject).toBe("Cannot send messages");
    expect(parsed.message).toBe("Hello\n\nSupport");
    expect(() =>
      createSupportCaseInputSchema.parse({
        ...parsed,
        message: "x".repeat(4_001),
      }),
    ).toThrow();
  });

  it("keeps requester detail free of administrator identity", () => {
    const detail = supportCaseDetailSchema.parse({
      id: "case-1",
      category: "PROFILE",
      subject: "Profile question",
      state: "WAITING_FOR_USER",
      version: 2,
      correspondent: "SmartHire Support",
      lastMessageAt: "2026-08-13T01:00:00.000Z",
      createdAt: "2026-08-13T00:00:00.000Z",
      updatedAt: "2026-08-13T01:00:00.000Z",
      contentAvailable: true,
      messages: [
        {
          id: "message-1",
          sequence: 1,
          author: "SMART_HIRE_SUPPORT",
          content: "We are reviewing this.",
          createdAt: "2026-08-13T01:00:00.000Z",
        },
      ],
    });
    expect(detail.messages[0]?.author).toBe("SMART_HIRE_SUPPORT");
    expect(detail).not.toHaveProperty("currentAssigneeUserId");
  });

  it("accepts content-free realtime invalidations only", () => {
    expect(
      supportInvalidationSchema.parse({
        caseId: "case-1",
        version: 3,
        state: "RESOLVED",
        change: "RESOLVED",
      }),
    ).toEqual({
      caseId: "case-1",
      version: 3,
      state: "RESOLVED",
      change: "RESOLVED",
    });
    expect(() =>
      supportInvalidationSchema.parse({
        caseId: "case-1",
        version: 3,
        state: "RESOLVED",
        change: "RESOLVED",
        content: "private",
      }),
    ).toThrow();
  });
});
