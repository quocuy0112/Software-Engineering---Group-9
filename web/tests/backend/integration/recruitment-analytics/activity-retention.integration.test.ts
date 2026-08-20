import { describe, expect, it } from "vitest";
import {
  ActivityRetentionService,
  auditRetentionDeadline,
} from "@/backend/analytics/activity-retention-service";

describe("analytics audit retention and legal holds", () => {
  it("uses a two-year calendar deadline and preserves scoped held events", async () => {
    const now = new Date("2026-03-01T00:00:00.000Z");
    const deleted: string[][] = [];
    const service = new ActivityRetentionService({
      findExpiredCandidates: async () => [
        {
          id: "event-free",
          occurredAt: new Date("2023-01-01T00:00:00.000Z"),
          correlationId: "correlation-free",
          targetType: "job_posting",
          targetId: "job-free",
        },
        {
          id: "event-held",
          occurredAt: new Date("2023-01-02T00:00:00.000Z"),
          correlationId: "correlation-held",
          targetType: "job_posting",
          targetId: "job-held",
        },
      ],
      activeLegalHolds: async () => [
        {
          id: "hold-1",
          scopeType: "TARGET",
          scopeReference: "job_posting:job-held",
          startsAt: new Date("2023-01-01T00:00:00.000Z"),
          endsAt: new Date("2027-01-01T00:00:00.000Z"),
          releasedAt: null,
        },
      ],
      deleteAuditEvents: async (ids) => {
        deleted.push([...ids]);
        return { count: ids.length };
      },
    });
    const result = await service.run(now, 100);
    expect(auditRetentionDeadline(now).toISOString()).toBe(
      "2024-03-01T00:00:00.000Z",
    );
    expect(result).toMatchObject({ eligible: 2, held: 1, deleted: 1 });
    expect(deleted).toEqual([["event-free"]]);
  });
});
