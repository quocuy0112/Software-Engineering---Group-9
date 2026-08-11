import { test, expect } from "./admin-e2e-fixture";
import { adminE2eControl } from "./admin-e2e-process";
import { queryAdminE2eState } from "./e2e-prisma";

type VerificationScenario = {
  runId: string;
  requestId: string;
  evidenceId: string;
  applicantUserId: string;
  kinds?: string[];
};

type VerificationState = {
  rows: Array<{
    id: string;
    status: string;
    idempotencyKey: string;
    templateVersion: string;
    payloadRef: { eventKind?: string };
  }>;
  request: null | {
    applicantUserId: string;
    requestedRole: string;
    notifications: Array<{ id: string; kind: string; payloadRef: unknown }>;
    targetCompany: null | { displayName: string };
  };
  candidateIdentity: unknown | null;
};

type DeliveryResult = {
  providerAttempts: number;
  transitions: Array<{
    status: string;
    attempts: number;
    at: string;
    nextAttemptAt: string;
    workStatus: string | null;
  }>;
  messages: Array<{ subject: string; text: string; html: string }>;
};

test.describe.configure({ mode: "serial" });

test.describe("employer verification — T074", () => {
  test("uses encrypted filesystem storage and an asynchronous SAFE/UNSAFE scanner", async ({
    adminPage,
    adminAuth,
  }) => {
    void adminPage;
    const safe = await adminE2eControl<VerificationScenario>(
      "create-verification",
      adminAuth.runId,
      "PENDING",
    );
    const safeResult = await adminE2eControl<{
      state: string;
      attemptCount: number;
      evidence: {
        storageLocator: string;
        malwareStatus: string;
        previewStatus: string;
      };
    }>("scan-evidence", safe.requestId, "SAFE");
    expect(safeResult).toMatchObject({
      state: "PENDING_REVIEW",
      attemptCount: 1,
      evidence: { malwareStatus: "PASS", previewStatus: "PASS" },
    });
    expect(safeResult.evidence.storageLocator).not.toContain(safe.requestId);

    const unsafe = await adminE2eControl<VerificationScenario>(
      "create-verification",
      adminAuth.runId,
      "PENDING",
    );
    const unsafeResult = await adminE2eControl<{
      state: string;
      attemptCount: number;
      evidence: { malwareStatus: string; previewStatus: string };
    }>("scan-evidence", unsafe.requestId, "UNSAFE");
    expect(unsafeResult).toMatchObject({
      state: "PENDING_CHECKS",
      attemptCount: 1,
      evidence: { malwareStatus: "FAIL", previewStatus: "FAIL" },
    });

    const applicantLifecycle = await adminE2eControl<{
      submittedState: string;
      changesState: string;
      resubmittedState: string;
      cancelledState: string;
      resubmissionCount: number;
      evidenceCount: number;
      inaccessibleEvidence: number;
      eventKinds: string[];
      prerequisiteError: string;
      candidateIdentityPreserved: boolean;
    }>("verification-applicant-lifecycle", adminAuth.userId, adminAuth.runId);
    expect(applicantLifecycle).toMatchObject({
      submittedState: "PENDING_CHECKS",
      changesState: "CHANGES_REQUESTED",
      resubmittedState: "PENDING_CHECKS",
      cancelledState: "CANCELLED",
      resubmissionCount: 1,
      evidenceCount: 2,
      inaccessibleEvidence: 2,
      prerequisiteError: "RELATIONSHIP_REQUIRED",
      candidateIdentityPreserved: true,
    });
    expect(applicantLifecycle.eventKinds).toEqual(
      expect.arrayContaining([
        "VERIFICATION_RECEIPT",
        "VERIFICATION_CHANGES_REQUESTED",
        "VERIFICATION_CANCELLED",
      ]),
    );

    // Uses an injected clock at the production 15m/24h/72h boundaries. No
    // sleep or shortened schedule is used, and every intermediate state is
    // asserted to avoid false confidence from jumping straight to EXPIRED.
    const outage = await adminE2eControl<{
      previewBytes: number;
      previewMediaType: string;
      escalatedAt15m: boolean;
      notifiedAt24h: boolean;
      stateAt72h: string;
      inaccessibleAt72h: boolean;
      eventKinds: string[];
    }>("verification-outage-lifecycle", adminAuth.runId);
    expect(outage.previewBytes).toBeGreaterThan(0);
    expect(outage.previewMediaType).toBe("image/png");
    expect(outage).toMatchObject({
      escalatedAt15m: true,
      notifiedAt24h: true,
      stateAt72h: "EXPIRED",
      inaccessibleAt72h: true,
    });
    expect(outage.eventKinds).toEqual(
      expect.arrayContaining(["VERIFICATION_DELAYED", "VERIFICATION_EXPIRED"]),
    );
  });

  test("renders all seven verification events and keeps provider SENT/DEAD authoritative", async ({
    adminPage,
    adminAuth,
  }) => {
    void adminPage;
    const scenario = await adminE2eControl<VerificationScenario>(
      "create-verification-events",
      adminAuth.runId,
    );
    const before = await queryAdminE2eState<VerificationState>(
      "verification",
      scenario.requestId,
    );
    expect(before.rows).toHaveLength(7);
    expect(new Set(before.rows.map((row) => row.payloadRef.eventKind))).toEqual(
      new Set(scenario.kinds),
    );
    for (const [index, row] of before.rows.entries()) {
      expect(row.templateVersion).toBe("verification-v1");
      expect(row.idempotencyKey).toMatch(/^email-delivery:verification:/u);
      expect(row.idempotencyKey).not.toContain(row.templateVersion);
      const delivery = await adminE2eControl<DeliveryResult>(
        "drive-email",
        row.id,
        index === 0
          ? "TRANSIENT_FAILURE"
          : index === before.rows.length - 1
            ? "PERMANENT_FAILURE"
            : "SUCCESS",
      );
      expect(delivery.messages.length).toBeGreaterThan(0);
      expect(delivery.messages[0]?.text).not.toMatch(
        /private note|storageLocator|fraud signal|admin identity/iu,
      );
      expect(delivery.transitions.at(-1)?.status).toBe(
        index === before.rows.length - 1 ? "DEAD" : "SENT",
      );
      if (index === 0) {
        expect(delivery.providerAttempts).toBe(3);
        expect(delivery.transitions.map((item) => item.status)).toEqual([
          "RETRYABLE",
          "RETRYABLE",
          "SENT",
        ]);
        expect(
          delivery.transitions
            .slice(1)
            .map(
              (item, transitionIndex) =>
                new Date(item.at).getTime() -
                new Date(delivery.transitions[transitionIndex]!.at).getTime(),
            ),
        ).toEqual([60_000, 5 * 60_000]);
      }
    }
  });

  test("allows one winner in a real concurrent approval and sends one complete approval email", async ({
    adminPage,
    adminAuth,
  }) => {
    void adminPage;
    const scenario = await adminE2eControl<VerificationScenario>(
      "create-verification",
      adminAuth.runId,
      "PASS",
    );
    const concurrency = await adminE2eControl<{
      fulfilled: number;
      rejected: number;
      replayed: boolean;
      receipts: number;
    }>("verification-concurrent", adminAuth.userId, scenario.requestId);
    expect(concurrency).toEqual({
      fulfilled: 1,
      rejected: 1,
      replayed: true,
      receipts: 1,
    });
    const state = await queryAdminE2eState<VerificationState>(
      "verification",
      scenario.requestId,
    );
    expect(state.request?.notifications).toHaveLength(1);
    expect(state.candidateIdentity).not.toBeNull();
    const approval = state.request?.notifications[0];
    expect(approval?.payloadRef).toMatchObject({
      eventKind: "VERIFICATION_APPROVED",
      companyDisplayName: state.request?.targetCompany?.displayName,
      approvedMembershipRole: "OWNER",
    });
    const delivery = await adminE2eControl<DeliveryResult>(
      "drive-email",
      approval!.id,
      "SUCCESS",
    );
    expect(delivery.transitions.at(-1)?.status).toBe("SENT");
    expect(delivery.messages[0]?.text).toContain(
      state.request?.targetCompany?.displayName,
    );
    expect(delivery.messages[0]?.text).toMatch(/OWNER/u);
    expect(delivery.messages[0]?.text).toMatch(/Recruiter workspace/iu);
    expect(delivery.messages[0]?.text).toMatch(/Candidate identity/iu);
  });
});
