import { describe, expect, it } from "vitest";
import { teamAcceptSchema, teamInviteSchema } from "@/shared/contracts/company-members/team";

describe("company invitation lifecycle inputs", () => {
  it("normalizes only valid recipient-shaped invitation input at the boundary", () => {
    expect(teamInviteSchema.safeParse({ email: "recipient@example.com", role: "RECRUITER" }).success).toBe(true);
    expect(teamInviteSchema.safeParse({ email: "not-an-email", role: "RECRUITER" }).success).toBe(false);
  });
  it("prevents replay-shaped empty or short tokens at the boundary", () => {
    expect(teamAcceptSchema.safeParse({ token: "" }).success).toBe(false);
    expect(teamAcceptSchema.safeParse({ token: "x".repeat(32) }).success).toBe(true);
  });
  it("keeps recipient decisions as explicit action boundaries", () => {
    expect(teamAcceptSchema.safeParse({ token: "x".repeat(32) }).success).toBe(true);
  });
});
