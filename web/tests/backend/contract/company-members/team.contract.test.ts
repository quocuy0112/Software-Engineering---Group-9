import { describe, expect, it } from "vitest";
import { teamAcceptSchema, teamInviteSchema, teamMembershipCommandSchema } from "@/shared/contracts/company-members/team";

describe("company team request contracts", () => {
  it("rejects Owner and unknown properties", () => {
    expect(teamInviteSchema.safeParse({ email: "member@example.com", role: "OWNER" }).success).toBe(false);
    expect(teamInviteSchema.safeParse({ email: "member@example.com", role: "RECRUITER", extra: true }).success).toBe(false);
  });
  it("accepts only a bounded opaque acceptance token", () => {
    expect(teamAcceptSchema.safeParse({ token: "x".repeat(32) }).success).toBe(true);
    expect(teamAcceptSchema.safeParse({ token: "short" }).success).toBe(false);
  });
  it("requires role only when changing a role", () => {
    expect(teamMembershipCommandSchema.safeParse({ action: "role", role: "HR_MANAGER" }).success).toBe(true);
    expect(teamMembershipCommandSchema.safeParse({ action: "remove", role: "RECRUITER" }).success).toBe(false);
  });
});
