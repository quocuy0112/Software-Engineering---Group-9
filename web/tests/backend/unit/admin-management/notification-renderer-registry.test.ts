import { describe, expect, it } from "vitest";
import { renderFeature006Email } from "@/backend/admin/notifications/renderer-registry";
import {
  accountBusinessEventKey,
  emailDeliveryIdempotencyKey,
  membershipBusinessEventKey,
  securityNotificationIdempotencyKey,
  verificationBusinessEventKey,
} from "@/backend/admin/notifications/notification-events";

const occurredAt = "2026-08-10T00:00:00.000Z";
const appUrl = "http://localhost:3001";
const forbidden = ["fraud", "administrator name", "internal rationale"];

describe("Feature 006 email renderer registry", () => {
  it.each([
    ["ACCOUNT_SUSPENDED", "SUSPENDED"],
    ["ACCOUNT_REINSTATED", "ACTIVE"],
    ["ALL_SESSIONS_REVOKED", "ACTIVE"],
  ] as const)(
    "renders admin-security-v1 %s safely",
    async (eventKind, state) => {
      const rendered = await renderFeature006Email({
        templateVersion: "admin-security-v1",
        appUrl,
        payloadRef: { eventKind, resultingState: state, occurredAt },
      });
      expect(rendered.text).toContain("Aug 10, 2026");
      expect(rendered.text).not.toContain(occurredAt);
      if (eventKind === "ACCOUNT_SUSPENDED") {
        expect(rendered.text).toContain("was suspended on");
        expect(rendered.text).toContain("Reason:");
        expect(rendered.text).toContain("restoring your account");
      } else if (eventKind === "ACCOUNT_REINSTATED") {
        expect(rendered.text).toContain("reactivated");
        expect(rendered.text).toContain("fully operational");
        expect(rendered.text).toContain("has been resolved");
      } else {
        expect(rendered.text).toContain("All SmartHire sessions were revoked");
      }
      for (const value of forbidden)
        expect(rendered.text.toLowerCase()).not.toContain(value);
    },
  );

  it.each([
    ["MEMBERSHIP_SUSPENDED", "SUSPENDED"],
    ["MEMBERSHIP_RESTORED", "ACTIVE"],
    ["MEMBERSHIP_REMOVED", "REMOVED"],
  ] as const)(
    "renders admin-security-v1 %s with company snapshot",
    async (eventKind, state) => {
      const rendered = await renderFeature006Email({
        templateVersion: "admin-security-v1",
        appUrl,
        payloadRef: {
          eventKind,
          companyDisplayName: "Acme Vietnam",
          resultingState: state,
          occurredAt,
        },
      });
      expect(rendered.text).toContain("Acme Vietnam");
      expect(rendered.text.toLowerCase()).toContain(
        state === "SUSPENDED" ? "suspended" : state === "REMOVED" ? "removed" : "restored",
      );
      expect(rendered.text.toLowerCase()).not.toContain("account suspended");
      expect(rendered.text.toLowerCase()).not.toContain("account locked");
    },
  );

  it.each([
    "VERIFICATION_RECEIPT",
    "VERIFICATION_CHANGES_REQUESTED",
    "VERIFICATION_REJECTED",
    "VERIFICATION_CANCELLED",
    "VERIFICATION_DELAYED",
    "VERIFICATION_EXPIRED",
  ] as const)("renders verification-v1 %s", async (eventKind) => {
    const rendered = await renderFeature006Email({
      templateVersion: "verification-v1",
      appUrl,
      payloadRef: {
        eventKind,
        requestId: "request-1",
        resultingState: "PENDING_REVIEW",
        occurredAt,
        nextAction: "WAIT_FOR_REVIEW",
      },
    });
    expect(rendered.text).toContain("request-1");
    expect(rendered.text).toContain("awaiting administrator review");
    expect(rendered.text).not.toContain("WAIT_FOR_REVIEW");
    for (const value of forbidden)
      expect(rendered.text.toLowerCase()).not.toContain(value);
  });

  it("renders verification approval with company-scoped role and server URL", async () => {
    const rendered = await renderFeature006Email({
      templateVersion: "verification-v1",
      appUrl,
      payloadRef: {
        eventKind: "VERIFICATION_APPROVED",
        requestId: "request-2",
        resultingState: "APPROVED",
        occurredAt,
        nextAction: "OPEN_RECRUITER_WORKSPACE",
        companyDisplayName: "Acme Vietnam",
        approvedMembershipRole: "RECRUITER",
      },
    });
    expect(rendered.text).toContain("Acme Vietnam is verified");
    expect(rendered.text).toContain("Company membership role: Recruiter");
    expect(rendered.text).toContain("console.recruiter.localhost");
    expect(rendered.text).toContain("Candidate identity remains unchanged");
  });

  it("renders account security email with recipient greeting and team signature", async () => {
    const rendered = await renderFeature006Email({
      templateVersion: "admin-security-v1",
      appUrl,
      payloadRef: {
        eventKind: "ACCOUNT_REINSTATED",
        resultingState: "ACTIVE",
        recipientName: "Khoi",
        occurredAt,
      },
    });
    expect(rendered.text).toContain("Hi Khoi,");
    expect(rendered.text).toContain("The SmartHire Team");
    expect(rendered.text).toContain("Log In to SmartHire");
    expect(rendered.text).not.toContain("resultingState");
    expect(rendered.text).not.toContain("reasonCategory");
  });

  it("fails unsupported event kinds explicitly instead of using token fallback", async () => {
    await expect(
      renderFeature006Email({
        templateVersion: "admin-security-v1",
        appUrl,
        payloadRef: { eventKind: "UNKNOWN", occurredAt },
      }),
    ).rejects.toThrow("ADMIN_SECURITY_EVENT_KIND_UNSUPPORTED");
    await expect(
      renderFeature006Email({
        templateVersion: "verification-v1",
        appUrl,
        payloadRef: { eventKind: "UNKNOWN", occurredAt },
      }),
    ).rejects.toThrow("VERIFICATION_EVENT_KIND_UNSUPPORTED");
  });
});

describe("business-event idempotency keys", () => {
  it("are based on aggregate, event kind, and resulting version only", () => {
    const account = accountBusinessEventKey(
      "account-1",
      "ACCOUNT_SUSPENDED",
      2,
    );
    const membership = membershipBusinessEventKey(
      "membership-1",
      "MEMBERSHIP_RESTORED",
      3,
    );
    const verification = verificationBusinessEventKey(
      "request-1",
      "VERIFICATION_APPROVED",
      4,
    );
    expect(securityNotificationIdempotencyKey(account)).toBe(
      "security-notification:account:account-1:ACCOUNT_SUSPENDED:version:2",
    );
    expect(emailDeliveryIdempotencyKey(membership)).toBe(
      "email-delivery:membership:membership-1:MEMBERSHIP_RESTORED:version:3",
    );
    expect(emailDeliveryIdempotencyKey(verification)).toBe(
      "email-delivery:verification:request-1:VERIFICATION_APPROVED:version:4",
    );
    for (const key of [account, membership, verification]) {
      expect(key).not.toContain("template");
      expect(key).not.toContain("correlation");
    }
  });
});
