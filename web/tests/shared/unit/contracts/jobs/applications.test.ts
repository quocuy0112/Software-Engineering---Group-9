import { describe, expect, it } from "vitest";
import {
  applicationStageGroup,
  applicationStageLabel,
  applicationStageSchema,
  candidateApplicationSummarySchema,
} from "@/shared/contracts/jobs/applications";

describe("canonical recruitment application contracts", () => {
  it("accepts exactly the nine canonical recruitment stages", () => {
    const stages = [
      "APPLIED",
      "VIEWED",
      "SHORTLISTED",
      "INTERVIEWING",
      "OFFERED",
      "HIRED",
      "OFFER_DECLINED",
      "REJECTED",
      "WAITLISTED",
    ] as const;

    expect(stages.map((stage) => applicationStageSchema.parse(stage))).toEqual(
      stages,
    );
    expect(applicationStageSchema.safeParse("submitted").success).toBe(false);
    expect(applicationStageSchema.safeParse("screening").success).toBe(false);
  });

  it("provides a visible label and useful filter group for every stage", () => {
    for (const stage of applicationStageSchema.options) {
      expect(applicationStageLabel[stage].length).toBeGreaterThan(0);
      expect(["ACTIVE", "ATTENTION", "COMPLETED", "PAUSED"]).toContain(
        applicationStageGroup[stage],
      );
    }
  });

  it("rejects recruiter-only fields from candidate summaries", () => {
    const result = candidateApplicationSummarySchema.safeParse({
      applicationId: "application-1",
      jobId: "job-1",
      jobSlug: "product-designer",
      jobTitle: "Product Designer",
      companyName: "SmartHire",
      companyLogoUrl: null,
      location: "Ho Chi Minh City",
      employmentType: "FULL_TIME",
      workArrangement: "HYBRID",
      stage: "APPLIED",
      stageVersion: 1,
      submittedAt: "2026-08-08T00:00:00.000Z",
      lastStageChangedAt: "2026-08-08T00:00:00.000Z",
      jobAvailable: true,
      recruiterNote: "internal",
    });

    expect(result.success).toBe(false);
  });
});
