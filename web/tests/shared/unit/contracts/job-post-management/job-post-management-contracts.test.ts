import { describe, expect, it } from "vitest";
import {
  jobManagementCommandSchema,
  visibilityStateSchema,
} from "@/shared/contracts/admin/job-post-management";

describe("job post management contracts", () => {
  it("uses independent visibility values", () => {
    expect(visibilityStateSchema.options).toEqual([
      "PUBLISHED",
      "HIDDEN",
      "ARCHIVED",
    ]);
  });

  it("accepts bounded lifecycle and featured commands", () => {
    expect(
      jobManagementCommandSchema.safeParse({
        command: "HIDE",
        confirmation: true,
        reason: "Policy investigation is in progress.",
      }).success,
    ).toBe(true);
    expect(
      jobManagementCommandSchema.safeParse({
        command: "FEATURE",
        confirmation: true,
        placement: "HOME_FEATURED",
        startsAt: "2026-08-16T01:00:00.000Z",
        endsAt: "2026-08-17T01:00:00.000Z",
        priority: 1,
        reason: "Approved campaign placement.",
      }).success,
    ).toBe(true);
  });

  it("requires a recruiter-visible explanation for enforcement change requests", () => {
    expect(
      jobManagementCommandSchema.safeParse({
        command: "ENFORCE",
        confirmation: true,
        type: "REQUEST_CHANGES",
        reportIds: ["report-1"],
        reason: "Reported content needs correction.",
        publicExplanation:
          "Please correct the salary and employment requirements before resubmitting.",
      }).success,
    ).toBe(true);
    expect(
      jobManagementCommandSchema.safeParse({
        command: "ENFORCE",
        confirmation: true,
        type: "REQUEST_CHANGES",
        reportIds: ["report-1"],
        reason: "Reported content needs correction.",
      }).success,
    ).toBe(false);
  });

  it("accepts the elevated company and recruiter enforcement types", () => {
    for (const type of ["SUSPEND_COMPANY", "SUSPEND_RECRUITER"] as const) {
      expect(
        jobManagementCommandSchema.safeParse({
          command: "ENFORCE",
          confirmation: true,
          type,
          reportIds: ["report-1"],
          reason: "Confirmed policy violation requires elevated enforcement.",
        }).success,
      ).toBe(true);
    }
  });
});
