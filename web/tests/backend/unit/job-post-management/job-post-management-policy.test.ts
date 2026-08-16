import { describe, expect, it } from "vitest";
import {
  assertJobPostManagementTransition,
  jobPostManagementScope,
} from "@/backend/jobs/management/job-post-management-policy";
import {
  assertFeatureWindow,
  FEATURED_PLACEMENT_CAPACITY,
} from "@/backend/jobs/management/job-post-feature-policy";

const now = new Date("2026-08-16T00:00:00.000Z");
const state = {
  visibility: "PUBLISHED" as const,
  applicationState: "OPEN" as const,
  softDeleted: false,
  applicationDeadline: new Date("2026-08-20T00:00:00.000Z"),
};

describe("job post management policy", () => {
  it("keeps state dimensions independent and rejects invalid lifecycle repeats", () => {
    expect(() =>
      assertJobPostManagementTransition(
        {
          command: "CLOSE_APPLICATIONS",
          confirmation: true,
          reason: "Hiring target is met",
        },
        state,
        now,
      ),
    ).not.toThrow();
    expect(() =>
      assertJobPostManagementTransition(
        {
          command: "HIDE",
          confirmation: true,
          reason: "Policy review is required",
        },
        { ...state, visibility: "HIDDEN" },
        now,
      ),
    ).toThrow("INVALID_STATE");
  });

  it("does not permit expired or archived jobs to reopen or feature", () => {
    expect(() =>
      assertJobPostManagementTransition(
        {
          command: "REOPEN_APPLICATIONS",
          confirmation: true,
          reason: "Reopening recruitment",
        },
        { ...state, applicationState: "CLOSED", applicationDeadline: now },
        now,
      ),
    ).toThrow("INVALID_STATE");
    expect(() =>
      assertJobPostManagementTransition(
        {
          command: "FEATURE",
          confirmation: true,
          placement: "HOME_FEATURED",
          startsAt: now,
          endsAt: new Date("2026-08-17T00:00:00.000Z"),
          priority: 1,
          reason: "Priority campaign",
        },
        { ...state, visibility: "ARCHIVED" },
        now,
      ),
    ).toThrow("VALIDATION_FAILED");
  });

  it("maps elevated commands and exposes a bounded capacity", () => {
    expect(jobPostManagementScope.SOFT_DELETE).toBe("JOB_POST_ENFORCE");
    expect(jobPostManagementScope.FEATURE).toBe("JOB_POST_FEATURE");
    expect(FEATURED_PLACEMENT_CAPACITY).toBe(6);
    expect(() =>
      assertFeatureWindow({
        command: "FEATURE",
        confirmation: true,
        placement: "HOME_FEATURED",
        startsAt: now,
        endsAt: now,
        priority: 1,
        reason: "Invalid feature window",
      }),
    ).toThrow("VALIDATION_FAILED");
  });
});
