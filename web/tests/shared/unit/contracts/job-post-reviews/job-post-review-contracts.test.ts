import { describe, expect, it } from "vitest";
import {
  adminReviewCommandSchema,
  jobPostReviewReasonCodeSchema,
  jobPostReviewListQuerySchema,
  jobPostReviewStateSchema,
} from "@/shared/contracts/admin/job-post-review";
import { jobReviewSnapshotSchema } from "@/shared/contracts/recruiter-job-posting";
import { buildJobReviewSnapshot } from "../../../../helpers/job-post-reviews/job-post-review-fixtures";

describe("job-post review contracts", () => {
  it("accepts only the canonical review states and reason codes", () => {
    expect(jobPostReviewStateSchema.options).toEqual([
      "PENDING_REVIEW",
      "APPROVED",
      "REJECTED",
      "WITHDRAWN",
    ]);
    expect(
      jobPostReviewReasonCodeSchema.safeParse("DUPLICATE_OR_SPAM").success,
    ).toBe(true);
    expect(
      jobPostReviewReasonCodeSchema.safeParse("FREE_FORM_REASON").success,
    ).toBe(false);
  });

  it("uses strict discriminated administrator commands", () => {
    expect(adminReviewCommandSchema.parse({ command: "CLAIM" })).toEqual({
      command: "CLAIM",
    });
    expect(
      adminReviewCommandSchema.safeParse({
        command: "REASSIGN",
        targetAdminUserId: "admin-2",
      }).success,
    ).toBe(true);
    expect(
      adminReviewCommandSchema.safeParse({
        command: "REJECT",
        reasonCode: "INCOMPLETE_OR_UNCLEAR",
        publicExplanation:
          "Please add the missing responsibilities and role expectations.",
        privateNote: "Internal policy review requested.",
      }).success,
    ).toBe(true);
    expect(
      adminReviewCommandSchema.safeParse({
        command: "APPROVE",
        reason: "forged",
      }).success,
    ).toBe(false);
  });

  it("bounds deleted review archive discovery to explicit record scopes", () => {
    expect(
      jobPostReviewListQuerySchema.parse({
        page: 1,
        perPage: 25,
        recordStatus: "DELETED",
      }).recordStatus,
    ).toBe("DELETED");
    expect(
      jobPostReviewListQuerySchema.safeParse({
        page: 1,
        perPage: 25,
        recordStatus: "PURGED",
      }).success,
    ).toBe(false);
  });

  it("accepts a complete snapshot and rejects every server-owned field", () => {
    expect(
      jobReviewSnapshotSchema.safeParse(buildJobReviewSnapshot()).success,
    ).toBe(true);
    for (const field of [
      "status",
      "approvalComment",
      "isVerified",
      "stats",
      "postedAt",
      "updatedAt",
      "publishedAt",
      "approvedAt",
    ]) {
      expect(
        jobReviewSnapshotSchema.safeParse({
          ...buildJobReviewSnapshot(),
          [field]: field.endsWith("At") ? "2026-08-15T00:00:00.000Z" : "forged",
        }).success,
        field,
      ).toBe(false);
    }
  });
});
