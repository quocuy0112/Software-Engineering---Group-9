import { describe, expect, it } from "vitest";
import {
  jobReportInputSchema,
  jobReportOutcomeSchema,
} from "@/shared/contracts/jobs/actions";
import { JobReportService } from "@/backend/services/jobs/job-report-service";

const actor = { userId: "user-1", sessionId: "session-1" };

describe("job report contract", () => {
  it("requires meaningful details for context-dependent reasons", () => {
    expect(() =>
      jobReportInputSchema.parse({ reason: "OTHER", details: "too short" }),
    ).toThrow();
    expect(
      jobReportInputSchema.parse({ reason: "FRAUD", details: null }),
    ).toEqual({ reason: "FRAUD", details: null });
  });

  it("returns the same neutral confirmation shape for new and duplicate concerns", async () => {
    let created = true;
    const reports = { submit: async () => ({ created }) };
    const publicJobs = {
      findPublicActionTarget: async () => ({ id: "job-1" }),
    };
    const limiter = {
      consume: async () => ({
        allowed: true,
        limit: 10,
        remaining: 9,
        retryAfterSeconds: 0,
      }),
    };
    const audit = { append: async () => "audit-1" };
    const service = new JobReportService(
      reports,
      publicJobs,
      limiter,
      audit,
      async () => "private-digest",
    );

    const first = await service.submit(actor, "job-1", {
      reason: "FRAUD",
      details: null,
    });
    created = false;
    const duplicate = await service.submit(actor, "job-1", {
      reason: "FRAUD",
      details: null,
    });
    expect(jobReportOutcomeSchema.parse(first.outcome)).toMatchObject({
      received: true,
      duplicate: false,
    });
    expect(jobReportOutcomeSchema.parse(duplicate.outcome)).toMatchObject({
      received: true,
      duplicate: true,
    });
    expect(first.outcome.message).toBe(duplicate.outcome.message);
  });

  it("communicates rate-limit retry timing and does not persist", async () => {
    const reports = {
      submit: async () => {
        throw new Error("must not persist");
      },
    };
    const publicJobs = {
      findPublicActionTarget: async () => ({ id: "job-1" }),
    };
    const limiter = {
      consume: async () => ({
        allowed: false,
        limit: 10,
        remaining: 0,
        retryAfterSeconds: 45,
      }),
    };
    const auditEvents: unknown[] = [];
    const audit = {
      append: async (event: unknown) => {
        auditEvents.push(event);
        return "audit-1";
      },
    };
    const service = new JobReportService(
      reports,
      publicJobs,
      limiter,
      audit,
      async () => "private-digest",
    );
    await expect(
      service.submit(actor, "job-1", { reason: "FRAUD", details: null }),
    ).rejects.toMatchObject({
      status: 429,
      body: { retryAfterSeconds: 45 },
    });
    expect(auditEvents).toHaveLength(1);
    expect(JSON.stringify(auditEvents)).not.toContain("private-digest");
  });
});
