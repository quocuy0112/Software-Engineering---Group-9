import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Feature 009 Group 2 verification boundaries", () => {
  it("shares transaction-local locks and checks between decisions", () => {
    const eligibility = source(
      "src/backend/admin/verification/verification-decision-eligibility.ts",
    );
    const approval = source(
      "src/backend/admin/verification/verification-approval-transaction.ts",
    );
    const review = source(
      "src/backend/admin/verification/verification-review-service.ts",
    );
    expect(eligibility).toContain("FOR UPDATE");
    expect(eligibility).toContain('applicant.state !== "ACTIVE"');
    expect(eligibility).toContain('evidence.malwareStatus !== "PASS"');
    expect(approval).toContain("loadVerificationDecisionEligibility");
    expect(review).toContain("loadVerificationDecisionEligibility");
    expect(review).toContain("adminComment: reason");
  });

  it("persists one dual-channel outcome and exposes Claim before Approve/Reject", () => {
    const notification = source(
      "src/backend/admin/notifications/verification-notification-event.ts",
    );
    const panel = source(
      "src/frontend/features/admin/verification/verification-decision-panel.tsx",
    );
    const provider = source("src/frontend/features/admin/app/data-provider.ts");
    expect(notification).toContain("verificationNotificationEvent");
    expect(notification).toContain('inAppStatus: "QUEUED"');
    expect(panel).toContain('submit("approve")');
    expect(panel).toContain('submit("reject")');
    expect(panel).toContain("Claim case");
    expect(provider).not.toContain("request-changes");
  });
});
