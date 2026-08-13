import { describe, expect, it } from "vitest";
import { notificationCopy } from "@/backend/repositories/connections/prisma-connection-repository";

describe("connection notification privacy", () => {
  it("uses symmetric, content-free terminal notifications", () => {
    const copy = notificationCopy("PROPOSAL_NO_LONGER_ACTIVE");
    expect(copy.message).not.toMatch(
      /declin|block|administrator|email|reason/iu,
    );
    expect(copy.message).toContain("no longer active");
  });
});
