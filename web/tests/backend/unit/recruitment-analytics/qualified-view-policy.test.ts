import { describe, expect, it } from "vitest";
import { classifyJobPostingView } from "@/backend/analytics/qualified-view-policy";

describe("qualified job-posting view policy", () => {
  const base = {
    postingId: "job-1",
    visitorIdentity: "ip:203.0.113.4",
    userAgent: "Mozilla/5.0",
    isOwnerPreview: false,
  } as const;

  it("uses one stable digest per visitor/posting/platform day", () => {
    const first = classifyJobPostingView({
      ...base,
      occurredAt: new Date("2026-01-01T02:00:00.000Z"),
    });
    const repeated = classifyJobPostingView({
      ...base,
      occurredAt: new Date("2026-01-01T10:00:00.000Z"),
    });
    const nextDay = classifyJobPostingView({
      ...base,
      occurredAt: new Date("2026-01-02T02:00:00.000Z"),
    });
    expect(first.qualification).toBe("QUALIFIED");
    expect(first.visitorDayDigest).toBe(repeated.visitorDayDigest);
    expect(first.visitorDayDigest).not.toBe(nextDay.visitorDayDigest);
    expect(first.visitorDayDigest).not.toContain(base.visitorIdentity);
  });

  it("excludes owner previews, bots, and invalid identities", () => {
    expect(
      classifyJobPostingView({
        ...base,
        isOwnerPreview: true,
        occurredAt: new Date("2026-01-01T00:00:00.000Z"),
      }).qualification,
    ).toBe("OWNER_PREVIEW");
    expect(
      classifyJobPostingView({
        ...base,
        userAgent: "Googlebot",
        occurredAt: new Date("2026-01-01T00:00:00.000Z"),
      }).qualification,
    ).toBe("AUTOMATED");
    expect(
      classifyJobPostingView({
        ...base,
        visitorIdentity: "",
        occurredAt: new Date("2026-01-01T00:00:00.000Z"),
      }).qualification,
    ).toBe("INVALID");
  });
});
