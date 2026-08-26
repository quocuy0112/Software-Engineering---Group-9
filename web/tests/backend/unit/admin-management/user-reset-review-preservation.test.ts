import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "../scripts/db-reset-user.mjs"),
  "utf8",
);

describe("targeted user reset review preservation", () => {
  it("deletes transient reviews only when the reset user submitted them", () => {
    expect(source).toContain("const resetAllAccounts = !requestedUserRef");
    expect(source).toContain("resetUserIdSet.has(version.submittedByUserId)");
  });

  it("releases the reset administrator without deleting recruiter submissions", () => {
    expect(source).toContain("assignedAdminUserId: userIdFilter");
    expect(source).toContain(
      "data: { assignedAdminUserId: null, assignedAt: null }",
    );
    expect(source).toContain("reviewAggregatePointerResetIds");
    expect(source).not.toContain(
      "where: { id: { in: reviewAggregates.map(({ id }) => id) } }",
    );
  });

  it("reassigns surviving pending reviews to another active administrator", () => {
    expect(source).toContain(
      "distributeUnassignedPendingReviews(transaction, now)",
    );
  });
});
