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
      scoringConfigVersion: "HS-40/60-v1",
      creationDedupeKey: "c".repeat(64),
      cvSnapshot: { versionId: "cv-1" },
      jdSnapshot: { jobId: "job-1" },
      expiresAt: new Date("2027-08-16T00:00:00.000Z"),
      createdAt: new Date("2026-08-16T00:00:00.000Z"),
    });

    const call = database.privateCvMatchCheck.create.mock.calls[0]?.[0] as {
      data: {
        attempts?: { create?: Record<string, unknown> };
        [key: string]: unknown;
      };
    };
    expect(call.data.attempts?.create).toEqual(
      expect.objectContaining({
        attemptNumber: 1,
        trigger: "INITIAL",
        state: "QUEUED",
        scoringPolicyVersion: "HS-40/60-v1",
      }),
    );
    expect(call.data).not.toHaveProperty("jobApplicationId");
    expect(call.data).not.toHaveProperty("companyId");
    expect(call.data).not.toHaveProperty("recruiterUserId");
  });

  it("reuses an accepted AI retry instead of reporting a duplicate conflict", async () => {
    const now = new Date("2026-08-16T00:00:00.000Z");
    const activeAttempt = {
      id: "retry-1",
      state: "AI_RUNNING",
      leaseExpiresAt: new Date(now.getTime() + 30_000),
    };
    const database = {
      privateCvMatchCheck: {
        findFirst: vi.fn().mockResolvedValue({
          currentAttempt: {
            id: "attempt-1",
            state: "READY",
            deterministicResultId: "automatic-1",
          },
          attempts: [activeAttempt],
          _count: { attempts: 2 },
        }),
      },
      privateCvMatchAttempt: {
        create: vi.fn(),
        updateMany: vi.fn(),
      },
    };
    const repository = new PrivateCvMatchRepository(database as never);

    const result = await repository.createAiRetryAttempt({
      candidateUserId: "candidate-a",
      checkId: "pmc-1",
      now,
      scoringPolicyVersion: "HS-40/60-v1",
    });

    expect(result).toBe(activeAttempt);
    expect(database.privateCvMatchAttempt.create).not.toHaveBeenCalled();
    expect(database.privateCvMatchAttempt.updateMany).not.toHaveBeenCalled();
  });

  it("allows re-running AI for a completed hybrid report", async () => {
    const now = new Date("2026-08-16T00:00:00.000Z");
    const database = {
      privateCvMatchCheck: {
        findFirst: vi.fn().mockResolvedValue({
          state: "READY",
          currentAttempt: {
            id: "attempt-1",
            state: "READY",
            deterministicResultId: "automatic-1",
          },
          attempts: [],
          _count: { attempts: 2 },
        }),
      },
      privateCvMatchAttempt: {
        create: vi.fn().mockResolvedValue({ id: "retry-1" }),
        updateMany: vi.fn(),
      },
    };
    const repository = new PrivateCvMatchRepository(database as never);

    await repository.createAiRetryAttempt({
      candidateUserId: "candidate-a",
      checkId: "pmc-1",
      now,
      scoringPolicyVersion: "HS-40/60-v1",
    });

    expect(database.privateCvMatchAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        checkId: "pmc-1",
        attemptNumber: 3,
        trigger: "AI_RETRY",
        state: "QUEUED",
        deterministicResultId: "automatic-1",
      }),
    });
  });

  it("requeues an AI retry whose worker lease has expired", async () => {
    const now = new Date("2026-08-16T00:00:00.000Z");
    const staleAttempt = {
      id: "retry-stale",
      state: "AI_RUNNING",
      leaseExpiresAt: new Date(now.getTime() - 1_000),
    };
    const database = {
      privateCvMatchCheck: {
        findFirst: vi.fn().mockResolvedValue({
          currentAttempt: {
            id: "attempt-1",
            state: "LIMITED",
            deterministicResultId: "automatic-1",
          },
          attempts: [staleAttempt],
          _count: { attempts: 2 },
        }),
      },
      privateCvMatchAttempt: {
        create: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          ...staleAttempt,
          state: "QUEUED",
          leaseOwner: null,
          leaseExpiresAt: null,
        }),
      },
    };
    const repository = new PrivateCvMatchRepository(database as never);

    await repository.createAiRetryAttempt({
      candidateUserId: "candidate-a",
      checkId: "pmc-1",
      now,
      scoringPolicyVersion: "HS-40/60-v1",
    });

    expect(database.privateCvMatchAttempt.updateMany).toHaveBeenCalledWith({
      where: {
        id: "retry-stale",
        state: "AI_RUNNING",
        OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }],
      },
      data: {
        state: "QUEUED",
        completedAt: null,
        failureCode: null,
        hybridScore: null,
        matchBand: null,
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    });
    expect(database.privateCvMatchAttempt.create).not.toHaveBeenCalled();
  });
});
