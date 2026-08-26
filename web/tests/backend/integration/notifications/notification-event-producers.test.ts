import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("notification event producer coverage", () => {
  it("adds safe in-app counterparts beside unchanged security emails", () => {
    const password = read(
      "src/backend/repositories/account/prisma-password-change-operation-repository.ts",
    );
    const emailChange = read(
      "src/backend/repositories/account/prisma-email-change-repository.ts",
    );
    const recovery = read(
      "src/backend/repositories/identity/prisma-account-recovery-repository.ts",
    );
    expect(password).toContain('templateVersion: "password-changed.v2"');
    expect(password).toContain('kind: "PASSWORD_CHANGED"');
    expect(emailChange).toContain('templateVersion: "email-change-alert.v1"');
    expect(emailChange).toContain('kind: "EMAIL_CHANGE_REQUESTED_ALERT"');
    for (const kind of [
      "RECOVERY_PENDING",
      "RECOVERY_CANCELLED",
      "RECOVERY_COMPLETED",
    ]) {
      expect(recovery).toContain(`kind: "${kind}"`);
    }
    expect(recovery).toContain(
      'templateVersion: "account-recovery-pending.v1"',
    );
  });

  it("covers workflow and terminal report outcomes", () => {
    const files = [
      "src/backend/services/jobs/application-stage-service.ts",
      "src/backend/repositories/jobs/prisma-job-application-repository.ts",
      "src/backend/repositories/support/prisma-support-repository.ts",
      "src/backend/repositories/connections/prisma-connection-repository.ts",
      "src/backend/repositories/messaging/prisma-messaging-report-repository.ts",
      "src/backend/admin/messaging-reports/admin-messaging-report-review-service.ts",
      "src/backend/admin/moderation/moderation-submission-service.ts",
      "src/backend/admin/moderation/moderation-review-service.ts",
    ]
      .map(read)
      .join("\n");
    for (const kind of [
      "APPLICATION_STAGE_CHANGED",
      "APPLICATION_SUBMITTED",
      "APPLICATION_RECEIVED",
      "SUPPORT_WAITING_FOR_USER",
      "SUPPORT_RESOLVED",
      "MESSAGE_REPORT_RECEIVED",
      "MESSAGE_REPORT_RESOLVED",
      "MESSAGE_REPORT_DISMISSED",
      "MODERATION_REPORT_RECEIVED",
      "MODERATION_REPORT_RESOLVED",
      "MODERATION_REPORT_DISMISSED",
    ]) {
      expect(files).toContain(kind);
    }
  });

  it("fans recruiter verification submissions out to active administrators", () => {
    const submission = read(
      "src/backend/admin/verification/applicant-verification-service.ts",
    );
    const outbox = read(
      "src/backend/admin/notifications/verification-outbox.ts",
    );
    expect(submission).toContain(
      "notifyActiveAdministratorsOfVerificationSubmission",
    );
    expect(outbox).toContain('language: "EN"');
    expect(outbox).toContain('state: "ACTIVE"');
  });

  it("covers actionable administrator support, report, verification, and delivery producers", () => {
    const files = [
      "src/backend/repositories/support/prisma-support-repository.ts",
      "src/backend/repositories/messaging/prisma-messaging-report-repository.ts",
      "src/backend/admin/moderation/moderation-submission-service.ts",
      "src/backend/admin/workers/verification-lifecycle-loop.ts",
      "src/backend/admin/notifications/security-notification-ops-alert.ts",
    ]
      .map(read)
      .join("\n");
    for (const kind of [
      "SUPPORT_CASE_RECEIVED",
      "SUPPORT_REQUESTER_REPLIED",
      "SUPPORT_CASE_REOPENED",
      "MESSAGE_REPORT_RECEIVED_ADMIN",
      "MODERATION_REPORT_RECEIVED_ADMIN",
      "VERIFICATION_REVIEW_OVERDUE",
      "DELIVERY_MANUAL_INTERVENTION_REQUIRED",
    ]) {
      expect(files).toContain(kind);
    }
    for (const forbidden of [
      "subject: row.subject",
      "message: input.content",
      "detail: command.detail",
      "evidence: input.evidenceMessageId",
    ]) {
      expect(files).not.toContain(forbidden);
    }
  });

  it("keeps application, message, and report receipts in-app-only", () => {
    const message = read(
      "src/backend/repositories/messaging/prisma-messaging-message-repository.ts",
    );
    const report = read(
      "src/backend/repositories/messaging/prisma-messaging-report-repository.ts",
    );
    expect(message).toContain('kind: "MESSAGE_RECEIVED"');
    expect(message).not.toContain("emailOutbox");
    expect(report).toContain('kind: "MESSAGE_REPORT_RECEIVED"');
    expect(report).not.toContain("emailOutbox");
  });

  it("creates job review requests inside the submission transaction", () => {
    const submission = read(
      "src/backend/jobs/review/job-post-submission-service.ts",
    );
    const cleanup = read(
      "tests/helpers/notifications/job-post-review-notification-cleanup.ts",
    );
    expect(submission).toContain("prisma.$transaction");
    expect(submission).toContain('kind: "JOB_POST_REVIEW_REQUESTED_ADMIN"');
    expect(submission).toContain('contextType: "JOB_POST_REVIEW"');
    expect(cleanup).toContain('contextType: "JOB_POST_REVIEW"');
  });
});
