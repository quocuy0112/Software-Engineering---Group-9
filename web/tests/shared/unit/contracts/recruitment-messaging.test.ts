import { describe, expect, it } from "vitest";
import {
  recruitmentAssignmentInputSchema,
  recruitmentMessageInputSchema,
  recruitmentThreadQuerySchema,
} from "@/shared/contracts/recruitment-messaging";

describe("recruitment messaging contracts", () => {
  it("accepts a normalized idempotent message and rejects unsafe extras", () => {
    expect(recruitmentMessageInputSchema.parse({
      clientOperationId: "0e784b1a-869b-4fe3-a003-c1d55af6794d",
      content: "  Hello recruiter  ",
    })).toMatchObject({ content: "Hello recruiter" });
    expect(() => recruitmentMessageInputSchema.parse({
      clientOperationId: "0e784b1a-869b-4fe3-a003-c1d55af6794d",
      content: "Hello",
      recipientUserId: "must-not-be-client-controlled",
    })).toThrow();
  });

  it("limits inbox filtering and assignment commands to safe scopes", () => {
    expect(recruitmentThreadQuerySchema.parse({ assignment: "unassigned" })).toEqual({ assignment: "unassigned" });
    expect(() => recruitmentThreadQuerySchema.parse({ assignment: "other" })).toThrow();
    expect(recruitmentAssignmentInputSchema.parse({ membershipId: "cmt132yko000agof00vw82vxr" })).toEqual({ membershipId: "cmt132yko000agof00vw82vxr" });
  });
});
