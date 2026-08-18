import { describe, expect, it, vi } from "vitest";
import { PrivateCvMatchRepository } from "@/backend/repositories/private-cv-match/prisma-private-cv-match-repository";

function fakeDatabase() {
  return {
    privateCvMatchCheck: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "pmc-1" }),
    },
    privateAutomaticMatchResult: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  };
}

describe("private CV match repository boundary", () => {
  it("requires candidate ownership and availability on private reads", async () => {
    const database = fakeDatabase();
    const repository = new PrivateCvMatchRepository(database as never);
    const now = new Date("2026-08-16T00:00:00.000Z");

    await repository.findOwnedCheck("candidate-a", "pmc-1", now);

    expect(database.privateCvMatchCheck.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "pmc-1",
          candidateUserId: "candidate-a",
          inaccessibleAt: null,
          deletedAt: null,
          expiresAt: { gt: now },
        },
      }),
    );
  });

  it("keeps deterministic retry results inside the owning private check", async () => {
    const database = fakeDatabase();
    const repository = new PrivateCvMatchRepository(database as never);

    await repository.findAutomaticResult("automatic-1", "candidate-a");

    expect(database.privateAutomaticMatchResult.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "automatic-1",
          attempt: { check: { candidateUserId: "candidate-a" } },
        },
      }),
    );
  });

  it("creates only private rows and an initial immutable attempt", async () => {
    const database = fakeDatabase();
    const repository = new PrivateCvMatchRepository(database as never);

    await repository.createCheck({
      id: "pmc-1",
      candidateUserId: "candidate-a",
      cvVersionId: "cv-1",
      cvVersion: 1,
      cvDigest: "a".repeat(64),
      jobPostingId: "job-1",
      jdVersion: 3,
      jdDigest: "b".repeat(64),
      scoringConfigVersion: "HS-60/40-v1",
      creationDedupeKey: "c".repeat(64),
      cvSnapshot: { versionId: "cv-1" },
      jdSnapshot: { jobId: "job-1" },
      expiresAt: new Date("2027-08-16T00:00:00.000Z"),
      createdAt: new Date("2026-08-16T00:00:00.000Z"),
    });

    const call = database.privateCvMatchCheck.create.mock.calls[0]?.[0] as {
      data: { attempts?: { create?: Record<string, unknown> }; [key: string]: unknown };
    };
    expect(call.data.attempts?.create).toEqual(expect.objectContaining({
      attemptNumber: 1,
      trigger: "INITIAL",
      state: "QUEUED",
      scoringPolicyVersion: "HS-60/40-v1",
    }));
    expect(call.data).not.toHaveProperty("jobApplicationId");
    expect(call.data).not.toHaveProperty("companyId");
    expect(call.data).not.toHaveProperty("recruiterUserId");
  });
});
