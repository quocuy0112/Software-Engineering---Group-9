import { describe, expect, it } from "vitest";
import {
  validateJobPostDecision,
  jobReviewSnapshotSha256,
} from "@/backend/jobs/review/job-post-review-policy";
import { buildJobReviewSnapshot } from "../../../helpers/job-post-reviews/job-post-review-fixtures";

const now = new Date("2026-08-15T00:00:00.000Z");
const snapshot = buildJobReviewSnapshot({
  applyDeadline: "2026-08-20T00:00:00.000Z",
});

const valid = {
  decision: "APPROVE" as const,
  reviewState: "PENDING_REVIEW" as const,
  assignedAdminUserId: "admin-1",
  actorUserId: "admin-1",
  administratorEligible: true,
  companyEligible: true,
  submitterEligible: true,
  currentAggregateVersion: 4,
  expectedAggregateVersion: 4,
  snapshot,
  storedSnapshotSha256: jobReviewSnapshotSha256(snapshot),
  now,
};

describe("job-post decision policy", () => {
  it("accepts only the assigned eligible administrator and exact content/version", () => {
    expect(validateJobPostDecision(valid).snapshot).toEqual(snapshot);
    for (const input of [
      { ...valid, actorUserId: "admin-2" },
      { ...valid, administratorEligible: false },
      { ...valid, companyEligible: false },
      { ...valid, submitterEligible: false },
      { ...valid, expectedAggregateVersion: 3 },
      { ...valid, storedSnapshotSha256: "0".repeat(64) },
    ])
      expect(() => validateJobPostDecision(input)).toThrow();
  });

  it("blocks expired approval while permitting an assigned rejection", () => {
    const expired = {
      ...valid,
      snapshot: { ...snapshot, applyDeadline: "2026-08-14T00:00:00.000Z" },
    };
    expired.storedSnapshotSha256 = jobReviewSnapshotSha256(expired.snapshot);
    expect(() => validateJobPostDecision(expired)).toThrow("DEADLINE_EXPIRED");
    expect(
      validateJobPostDecision({
        ...expired,
        decision: "REJECT",
        companyEligible: false,
        submitterEligible: false,
      }).snapshot,
    ).toEqual(expired.snapshot);
  });
});
