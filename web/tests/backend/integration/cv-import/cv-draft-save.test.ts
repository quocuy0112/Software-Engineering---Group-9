import { Pool } from "pg";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { CvDraftComparisonService } from "@/backend/services/cv-import/cv-draft-comparison-service";
import { assertReviewPayloadCaps } from "@/shared/contracts/cv-import/review";
import {
  cleanupReviewAccounts,
  seedReviewDraft,
} from "../../../helpers/cv-review-fixture";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const accounts: string[] = [];

afterEach(async () => {
  const client = await pool.connect();
  try {
    await cleanupReviewAccounts(client, accounts.splice(0));
  } finally {
    client.release();
  }
});
afterAll(async () => pool.end());

describe.sequential("CV draft complete-payload save", () => {
  it("normalizes a complete review, increments once, and rejects stale CAS", async () => {
    const client = await pool.connect();
    const seeded = await seedReviewDraft(client, "save");
    accounts.push(seeded.accountId);
    client.release();
    const service = new CvDraftComparisonService();
    const comparison = await service.get(seeded.accountId, seeded.draftId);
    const reviewDecisions = {
      ...comparison.reviewDecisions,
      reviewComplete: true,
    };
    const request = {
      baseDraftRevision: 0,
      reviewedProfileRevision: 0,
      proposals: {
        ...comparison.proposals,
        scalars: comparison.proposals.scalars.map((proposal) => ({
          ...proposal,
          value: "  Platform   Engineer  ",
        })),
      },
      reviewDecisions,
    };
    await expect(
      service.save(seeded.accountId, seeded.draftId, request),
    ).resolves.toMatchObject({
      draftRevision: 1,
    });
    await expect(
      service.save(seeded.accountId, seeded.draftId, request),
    ).rejects.toMatchObject({
      code: "DRAFT_REVISION_CONFLICT",
    });
    const saved = await service.get(seeded.accountId, seeded.draftId);
    expect(saved.proposals.scalars[0]?.value).toBe("Platform Engineer");
    expect(saved.reviewDecisions.reviewComplete).toBe(true);
  });

  it("rejects oversized payloads without a partial revision", async () => {
    const client = await pool.connect();
    const seeded = await seedReviewDraft(client, "oversize");
    accounts.push(seeded.accountId);
    client.release();
    const service = new CvDraftComparisonService();
    const comparison = await service.get(seeded.accountId, seeded.draftId);
    const invalid = structuredClone(comparison);
    invalid.proposals.scalars[0]!.value = "x".repeat(5_001);
    await expect(
      service.save(seeded.accountId, seeded.draftId, {
        baseDraftRevision: 0,
        reviewedProfileRevision: 0,
        proposals: invalid.proposals,
        reviewDecisions: invalid.reviewDecisions,
      }),
    ).rejects.toBeInstanceOf(Error);
    expect(
      (await service.get(seeded.accountId, seeded.draftId)).draftRevision,
    ).toBe(0);
  });

  it("enforces canonical draft/provenance byte caps before persistence", () => {
    expect(() =>
      assertReviewPayloadCaps({
        proposals: { oversized: "x".repeat(256 * 1024) },
        decisions: {},
      }),
    ).toThrow("CV_DRAFT_PAYLOAD_LIMIT_EXCEEDED");
    expect(() =>
      assertReviewPayloadCaps({
        proposals: {},
        decisions: {},
        provenance: { oversized: "x".repeat(128 * 1024) },
      }),
    ).toThrow("CV_PROVENANCE_LIMIT_EXCEEDED");
  });

  it("persists explicit add, replace, and skip choices without mutating Profile", async () => {
    const client = await pool.connect();
    const seeded = await seedReviewDraft(client, "decision-semantics");
    accounts.push(seeded.accountId);
    const targetId = `owned-target-${seeded.profileId}`;
    await client.query(
      `INSERT INTO "ProfileExperience" ("id", "profileId", "position", "title", "company", "startDate", "endDate", "isCurrent", "createdAt", "updatedAt")
       VALUES ($1, $2, 0, 'Existing', 'Owned', DATE '2020-01-01', DATE '2021-01-01', false, $3, $3)`,
      [targetId, seeded.profileId, new Date("2026-08-01T08:00:00.000Z")],
    );
    client.release();
    const service = new CvDraftComparisonService();
    const comparison = await service.get(seeded.accountId, seeded.draftId);
    const reviewDecisions = {
      ...comparison.reviewDecisions,
      reviewComplete: true,
      scalars: comparison.reviewDecisions.scalars.map((decision) => ({
        ...decision,
        action: "ADD" as const,
      })),
      experiences: comparison.reviewDecisions.experiences.map((decision) => ({
        ...decision,
        action: "REPLACE" as const,
        targetId,
      })),
      skills: comparison.reviewDecisions.skills.map((decision) => ({
        ...decision,
        action: "SKIP" as const,
      })),
    };
    await service.save(seeded.accountId, seeded.draftId, {
      baseDraftRevision: 0,
      reviewedProfileRevision: 0,
      proposals: comparison.proposals,
      reviewDecisions,
    });
    const saved = await service.get(seeded.accountId, seeded.draftId);
    expect(saved.reviewDecisions).toMatchObject(reviewDecisions);
    expect(saved.currentProfile).toMatchObject({ headline: null, revision: 0 });
  });
});
