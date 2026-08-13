import { describe, expect, it } from "vitest";
import {
  adminProposalSchema,
  connectionInvalidationSchema,
  createConnectionProposalInputSchema,
  decideConnectionProposalInputSchema,
  participantProposalSchema,
} from "@/shared/contracts/connections";

describe("professional connection contracts", () => {
  it("accepts a bounded bilateral proposal and rejects self proposals", () => {
    expect(
      createConnectionProposalInputSchema.parse({
        participantAId: "account-a",
        participantBId: "account-b",
        reason: "Relevant professional introduction",
        expiryDays: 7,
      }),
    ).toMatchObject({ expiryDays: 7 });
    expect(
      createConnectionProposalInputSchema.safeParse({
        participantAId: "same",
        participantBId: "same",
        reason: "Relevant professional introduction",
        expiryDays: 7,
      }).success,
    ).toBe(false);
  });

  it("requires versioned idempotent participant decisions", () => {
    expect(
      decideConnectionProposalInputSchema.safeParse({
        decision: "ACCEPTED",
        expectedVersion: 1,
        idempotencyKey: crypto.randomUUID(),
      }).success,
    ).toBe(true);
    expect(
      decideConnectionProposalInputSchema.safeParse({
        decision: "ACCEPTED",
        expectedVersion: 0,
        idempotencyKey: "bad",
      }).success,
    ).toBe(false);
  });

  it("keeps participant and realtime projections content-minimized", () => {
    const participantKeys = Object.keys(participantProposalSchema.shape);
    expect(participantKeys).not.toContain("otherDecision");
    expect(participantKeys).not.toContain("email");
    expect(Object.keys(connectionInvalidationSchema.shape)).toEqual([
      "proposalId",
      "connectionId",
      "version",
      "state",
      "change",
    ]);
    expect(Object.keys(adminProposalSchema.shape)).not.toContain("messages");
  });
});
