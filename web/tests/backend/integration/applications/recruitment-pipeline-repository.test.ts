import { describe, expect, it, vi } from "vitest";
import { PrismaApplicationRepository } from "@/backend/repositories/applications/prisma-application-repository";

const stages = ["APPLIED", "VIEWED", "SHORTLISTED", "INTERVIEWING", "OFFERED", "HIRED", "OFFER_DECLINED", "REJECTED", "WAITLISTED"] as const;

function row(index: number, stage = "APPLIED") {
  return {
    id: `application-${String(index).padStart(5, "0")}`,
    submittedAt: new Date(1_800_000_000_000 - index),
    stage,
    stageVersion: 1,
    scoringStatus: "NOT_REQUESTED",
    currentScoringResult: null,
    candidate: { user: { name: `Candidate ${index}`, image: null, emailVerified: true } },
    applicationDocuments: [{ kind: "CV" }],
    coverLetterText: null,
    coverLetter: null,
  };
}

function scoredRow(index: number, stage = "VIEWED") {
  return {
    ...row(index, stage),
    scoringStatus: "COMPLETED",
    currentScoringResult: {
      state: "SCORED",
      finalScore: 82,
      aiScore: 78,
      mediumThreshold: 60,
      highThreshold: 80,
    },
  };
}

describe("pipeline repository", () => {
  it("returns authoritative counts for all nine stages", async () => {
    const db = {
      jobApplication: {
        groupBy: vi.fn().mockResolvedValue([{ stage: "APPLIED", _count: { _all: 4 } }]),
      },
    };
    const repository = new PrismaApplicationRepository(db as never);
    const counts = await repository.countPipelineStages("job-1");
    expect(Object.keys(counts)).toEqual(stages);
    expect(counts.APPLIED).toBe(4);
    expect(counts.HIRED).toBe(0);
  });

  it("binds signed cursors to the canonical job and stage and orders deterministically", async () => {
    const db = { jobApplication: { findMany: vi.fn().mockResolvedValue([row(1), row(2), row(3)]) } };
    const repository = new PrismaApplicationRepository(db as never);
    const first = await repository.listPipelineStage({ jobId: "job-1", stage: "APPLIED", limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toBeTruthy();
    await expect(repository.listPipelineStage({ jobId: "job-2", stage: "APPLIED", limit: 2, cursor: first.nextCursor! })).rejects.toThrow("INVALID_CURSOR");
    await expect(repository.listPipelineStage({ jobId: "job-1", stage: "VIEWED", limit: 2, cursor: first.nextCursor! })).rejects.toThrow("INVALID_CURSOR");
    expect(db.jobApplication.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ submittedAt: "desc" }, { id: "desc" }], take: 3 }));
  });

  it("projects scored cards without leaking score-label fields outside the pipeline contract", async () => {
    const db = {
      jobApplication: {
        findMany: vi.fn().mockResolvedValue([scoredRow(1)]),
      },
    };
    const repository = new PrismaApplicationRepository(db as never);

    const page = await repository.listPipelineStage({
      jobId: "job-1",
      stage: "VIEWED",
      limit: 25,
    });

    expect(page.items[0]?.score).toMatchObject({
      state: "SCORED",
      final: 82,
      aiScore: 78,
      aiScoreBand: { code: "MEDIUM_MATCH", label: "Review needed" },
    });
    expect(page.items[0]?.score?.aiScoreBand).not.toHaveProperty("iconLabel");
  });

  it("keeps pages bounded and supports complete 10,000-card traversal without duplicates", async () => {
    const rows = Array.from({ length: 10_000 }, (_, index) => row(index));
    const db = { jobApplication: { findMany: vi.fn(async (query: { where: { AND: Array<{ OR?: unknown }> }; take: number }) => {
      const cursorClause = query.where.AND.at(-1) as { OR?: Array<{ id?: { lt: string } }> } | undefined;
      const id = cursorClause?.OR?.[1]?.id?.lt;
      const start = id ? rows.findIndex((item) => item.id === id) + 1 : 0;
      return rows.slice(start, start + query.take);
    }) } };
    const repository = new PrismaApplicationRepository(db as never);
    const seen = new Set<string>();
    let cursor: string | undefined;
    do {
      const page = await repository.listPipelineStage({ jobId: "job-1", stage: "APPLIED", limit: 100, cursor });
      page.items.forEach((item) => seen.add(item.applicationId));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(seen.size).toBe(10_000);
    expect(db.jobApplication.findMany).toHaveBeenCalledTimes(100);
  });
});
