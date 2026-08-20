import { describe, expect, it } from "vitest";
import { teamMembershipCommandSchema } from "@/shared/contracts/company-members/team";

describe("company team lifecycle command matrix", () => {
  it("permits only the managed role transition command", () => {
    expect(teamMembershipCommandSchema.parse({ action: "role", role: "HR_MANAGER" })).toMatchObject({ action: "role", role: "HR_MANAGER" });
  });
  it("permits explicit suspend, restore, and remove commands", () => {
    for (const action of ["suspend", "restore", "remove"] as const) expect(teamMembershipCommandSchema.safeParse({ action }).success).toBe(true);
  });
});
