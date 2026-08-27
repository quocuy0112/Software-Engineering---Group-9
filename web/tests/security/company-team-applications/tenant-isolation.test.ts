import { describe, expect, it } from "vitest";
import {
  candidateTeamApplicationSchema,
  ownerTeamApplicationSchema,
} from "@/shared/contracts/company-members/team-applications";
import { teamApplicationFixture } from "../../helpers/company-team-applications-fixture";

describe("Company and Team Application tenant isolation", () => {
  it("keeps CV metadata, applicant email, and rejection details out of candidate status", () => {
    const candidateStatus = teamApplicationFixture();
    expect(
      candidateTeamApplicationSchema.safeParse(candidateStatus).success,
    ).toBe(true);
    expect(
      candidateTeamApplicationSchema.safeParse({
        ...candidateStatus,
        applicationEmail: "candidate@example.com",
        cvFileName: "resume.pdf",
        rejectionReason: "private",
      }).success,
    ).toBe(false);
  });

  it("requires Owner-only fields to be supplied by the separate Owner projection", () => {
    const candidateStatus = teamApplicationFixture();
    expect(ownerTeamApplicationSchema.safeParse(candidateStatus).success).toBe(
      false,
    );
  });
});
