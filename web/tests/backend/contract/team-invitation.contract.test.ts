import { describe, expect, it } from "vitest";
import { teamApplicationAcceptSchema } from "@/shared/contracts/company-members/team-applications";
import {
  teamAcceptSchema,
  teamInvitationReferenceSchema,
} from "@/shared/contracts/company-members/team";

describe("Team invitation contract", () => {
  it("requires a supported confirmed role for an Owner decision", () => {
    expect(
      teamApplicationAcceptSchema.safeParse({ role: "RECRUITER" }).success,
    ).toBe(true);
    expect(
      teamApplicationAcceptSchema.safeParse({ role: "OWNER" }).success,
    ).toBe(false);
  });

  it("keeps token acceptance on the existing bounded invitation contract", () => {
    expect(teamAcceptSchema.safeParse({ token: "t".repeat(32) }).success).toBe(
      true,
    );
    expect(teamAcceptSchema.safeParse({ token: "short" }).success).toBe(false);
  });

  it("allows a notification to reference an invitation without exposing its token", () => {
    expect(
      teamInvitationReferenceSchema.safeParse({ invitationId: "invite-1" })
        .success,
    ).toBe(true);
    expect(
      teamInvitationReferenceSchema.safeParse({
        invitationId: "invite-1",
        token: "t".repeat(32),
      }).success,
    ).toBe(false);
  });
});
