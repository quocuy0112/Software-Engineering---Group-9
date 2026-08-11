import { test, expect } from "./admin-e2e-fixture";
import { adminE2eControl } from "./admin-e2e-process";
import { queryAdminE2eState } from "./e2e-prisma";

type MembershipScenario = {
  runId: string;
  userId: string;
  membershipId: string;
  unrelatedMembershipId: string;
  companyDisplayName: string;
};

type MembershipState = {
  membership: {
    id: string;
    userId: string;
    companyId: string;
    status: string;
    company: { displayName: string };
    user: { candidateIdentity: unknown | null };
  };
  works: Array<{
    kind: string;
    payloadRef: { companyDisplayName?: string; resultingState?: string };
    emailOutbox: null | { id: string; idempotencyKey: string; status: string };
  }>;
  unrelated: Array<{ id: string; companyId: string; status: string }>;
};

type DeliveryResult = {
  transitions: Array<{ status: string; workStatus: string | null }>;
  messages: Array<{ text: string; html: string }>;
};

test.describe.configure({ mode: "serial" });

test.describe("company-scoped membership lifecycle — T097", () => {
  test("sends exactly one scoped email for suspend, restore, and remove", async ({
    adminPage,
    adminAuth,
  }) => {
    void adminPage;
    const scenario = await adminE2eControl<MembershipScenario>(
      "create-membership",
      adminAuth.runId,
    );
    await adminE2eControl(
      "membership-sequence",
      adminAuth.userId,
      scenario.membershipId,
    );
    await adminE2eControl("dispatch-security");
    const state = await queryAdminE2eState<MembershipState>(
      "membership",
      scenario.membershipId,
    );
    expect(state.works).toHaveLength(3);
    expect(new Set(state.works.map((row) => row.kind))).toEqual(
      new Set([
        "MEMBERSHIP_SUSPENDED",
        "MEMBERSHIP_RESTORED",
        "MEMBERSHIP_REMOVED",
      ]),
    );
    for (const work of state.works) {
      expect(work.payloadRef).toMatchObject({
        companyDisplayName: scenario.companyDisplayName,
      });
      expect(work.emailOutbox?.idempotencyKey).toMatch(
        /^email-delivery:membership:/u,
      );
      const delivery = await adminE2eControl<DeliveryResult>(
        "drive-email",
        work.emailOutbox!.id,
        "SUCCESS",
      );
      expect(delivery.transitions.at(-1)).toMatchObject({
        status: "SENT",
        workStatus: "DELIVERED",
      });
      const text = delivery.messages[0]?.text ?? "";
      expect(text).toContain(scenario.companyDisplayName);
      expect(text).toContain(work.payloadRef.resultingState);
      expect(text).not.toMatch(/account.*(locked|suspended|removed)/iu);
    }
  });

  test("rejects stale repeats without email and preserves Candidate/multi-company isolation", async ({
    adminPage,
    adminAuth,
  }) => {
    void adminPage;
    const scenario = await adminE2eControl<MembershipScenario>(
      "create-membership",
      adminAuth.runId,
    );
    const sequence = await adminE2eControl<{ stale: string }>(
      "membership-sequence",
      adminAuth.userId,
      scenario.membershipId,
    );
    expect(sequence.stale).toMatch(/STALE_CONFLICT|INVALID_STATE/u);
    const state = await queryAdminE2eState<MembershipState>(
      "membership",
      scenario.membershipId,
    );
    expect(state.works).toHaveLength(3);
    expect(state.membership.status).toBe("REMOVED");
    expect(state.membership.user.candidateIdentity).not.toBeNull();
    const unrelated = state.unrelated.find(
      (row) => row.id === scenario.unrelatedMembershipId,
    );
    expect(unrelated?.status).toBe("ACTIVE");
    expect(unrelated?.companyId).not.toBe(state.membership.companyId);

    const guards = await adminE2eControl<{
      beforeAvailable: boolean;
      beforeMembershipVersion: number;
      afterAvailable: boolean;
      afterCompanies: number;
      staleRecruiterSnapshotRejected: boolean;
      lastOwner: string;
      lastOwnerStatus: string;
      lastOwnerWorkCount: number;
      candidateIdentityPreserved: boolean;
    }>("membership-guards", adminAuth.userId, adminAuth.runId);
    expect(guards).toEqual({
      beforeAvailable: true,
      beforeMembershipVersion: 1,
      afterAvailable: false,
      afterCompanies: 0,
      staleRecruiterSnapshotRejected: true,
      lastOwner: "LAST_ACTIVE_OWNER",
      lastOwnerStatus: "ACTIVE",
      lastOwnerWorkCount: 0,
      candidateIdentityPreserved: true,
    });
  });
});
