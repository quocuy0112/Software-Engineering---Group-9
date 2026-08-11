import { describe, expect, it } from "vitest";
import { RecruiterHeaderStatusService } from "@/backend/recruiter-header/recruiter-header-status-service";
import type {
  RecruiterHeaderRequestState,
  RecruiterHeaderStatusRepositoryPort,
} from "@/backend/recruiter-header/recruiter-header-status-repository";

function service(
  hasQualifyingMembership: boolean,
  latestRequestState: RecruiterHeaderRequestState | null,
) {
  const repository: RecruiterHeaderStatusRepositoryPort = {
    hasQualifyingMembership: async () => hasQualifyingMembership,
    findLatestVerificationState: async () => latestRequestState,
  };
  return new RecruiterHeaderStatusService(
    repository,
    {
      candidate: "https://candidate.example.test",
      admin: "https://admin.example.test",
      recruiter: "https://recruiter.example.test",
    },
    () => new Date("2026-08-11T00:00:00.000Z"),
  );
}

describe("recruiter header status service", () => {
  it.each([
    ["PENDING_CHECKS"],
    ["PENDING_REVIEW"],
    ["CHANGES_REQUESTED"],
    ["RESUBMITTED"],
  ])("maps %s to pending review", async (state) => {
    await expect(
      service(false, state as never).resolveForUser("u-1"),
    ).resolves.toMatchObject({
      state: "PENDING_REVIEW",
      destinationKind: "NONE",
      href: null,
    });
  });

  it("gives active entitlement precedence over rejected history", async () => {
    await expect(
      service(true, "REJECTED").resolveForUser("u-1"),
    ).resolves.toMatchObject({
      state: "APPROVED",
      destinationKind: "RECRUITER_WORKSPACE",
      href: "https://recruiter.example.test",
    });
  });

  it.each([null, "CANCELLED", "EXPIRED", "APPROVED"])(
    "maps %s history to never applied without entitlement",
    async (state) => {
      await expect(
        service(false, state as never).resolveForUser("u-1"),
      ).resolves.toMatchObject({
        state: "NEVER_APPLIED",
        href: "/dashboard/employer-verification",
      });
    },
  );

  it("maps rejection to employer verification", async () => {
    await expect(
      service(false, "REJECTED").resolveForUser("u-1"),
    ).resolves.toMatchObject({
      state: "REJECTED",
      href: "/dashboard/employer-verification",
    });
  });
});
