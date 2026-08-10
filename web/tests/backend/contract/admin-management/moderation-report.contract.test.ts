import { describe, expect, it } from "vitest";
import {
  moderationPriority,
  moderationSubmissionSchema,
} from "@/shared/contracts/admin/moderation";

describe("moderation contracts", () => {
  it("normalizes exact plain text and removes executable/bidi content", () => {
    const value = moderationSubmissionSchema.parse({
      target: { type: "JOB", reference: "job-1" },
      category: "OTHER",
      detail:
        "<script>steal()</script>\u202EUseful report detail\r\n\r\n\r\nnext",
    });
    expect(value.detail).toBe("Useful report detail\n\nnext");
  });
  it("requires detail for OTHER and rejects over-limit content", () => {
    expect(() =>
      moderationSubmissionSchema.parse({
        target: { type: "JOB", reference: "job-1" },
        category: "OTHER",
        detail: "short",
      }),
    ).toThrow();
    expect(() =>
      moderationSubmissionSchema.parse({
        target: { type: "JOB", reference: "job-1" },
        category: "MISLEADING_CONTENT",
        detail: "x".repeat(2001),
      }),
    ).toThrow();
  });
  it("uses the approved deterministic priority mapping", () => {
    expect(moderationPriority("ABUSE_OR_THREATS")).toBe("CRITICAL");
    expect(moderationPriority("FRAUD_OR_IMPERSONATION")).toBe("HIGH");
    expect(moderationPriority("OTHER")).toBe("NORMAL");
  });
});
