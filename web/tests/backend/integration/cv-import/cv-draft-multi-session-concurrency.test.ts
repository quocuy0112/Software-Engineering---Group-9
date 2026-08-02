import { randomBytes } from "node:crypto";

import { Pool } from "pg";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { PrismaCvConfirmationRepository } from "@/backend/repositories/cv-import/prisma-cv-confirmation-repository";
import { CvDraftComparisonService } from "@/backend/services/cv-import/cv-draft-comparison-service";
import {
  cleanupReviewAccounts,
  cvReviewFixtureNow,
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

describe.sequential("CV draft multi-session concurrency", () => {
  it("accepts one complete-payload writer and returns exact safe winner metadata to the stale writer", async () => {
    const client = await pool.connect();
    const seeded = await seedReviewDraft(client, "two-writers");
    accounts.push(seeded.accountId);
    client.release();

    const service = new CvDraftComparisonService();
    const sessionA = structuredClone(
      await service.get(seeded.accountId, seeded.draftId),
    );
    const sessionB = structuredClone(sessionA);
    sessionA.proposals.scalars[0]!.value = "Session A headline";
    sessionA.proposals.experiences[0]!.value.title = "Session A role";
    sessionB.proposals.scalars[0]!.value = "Session B headline";
    sessionB.proposals.experiences[0]!.value.company = "Session B company";

    const outcomes = await Promise.allSettled(
      [sessionA, sessionB].map((session) =>
        service.save(seeded.accountId, seeded.draftId, {
          baseDraftRevision: 0,
          reviewedProfileRevision: 0,
          proposals: session.proposals,
          reviewDecisions: {
            ...session.reviewDecisions,
            reviewComplete: true,
          },
        }),
      ),
    );
    const winners = outcomes.filter(
      (outcome) => outcome.status === "fulfilled",
    );
    const losers = outcomes.filter((outcome) => outcome.status === "rejected");
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(winners[0]).toMatchObject({
      value: { draftRevision: 1, reviewedProfileRevision: 0 },
    });

    const authority = await pool.query<{
      revision: number;
      draftUpdatedAt: Date;
      profileRevision: number;
      profileUpdatedAt: Date;
      proposalPayload: Record<string, unknown[]>;
    }>(
      `SELECT draft."revision", draft."updatedAt" AS "draftUpdatedAt",
              profile."revision" AS "profileRevision",
              profile."updatedAt" AS "profileUpdatedAt",
              draft."proposalPayload" AS "proposalPayload"
         FROM "CvDraft" draft
         JOIN "CandidateProfile" profile ON profile."id" = draft."profileId"
        WHERE draft."id" = $1`,
      [seeded.draftId],
    );
    const state = authority.rows[0]!;
    const failure = (losers[0] as PromiseRejectedResult).reason as {
      code?: string;
      latest?: unknown;
    };
    expect(failure).toMatchObject({
      code: "DRAFT_REVISION_CONFLICT",
      latest: {
        draftRevision: 1,
        profileRevision: 0,
        draftUpdatedAt: state.draftUpdatedAt.toISOString(),
        profileUpdatedAt: state.profileUpdatedAt.toISOString(),
      },
    });
    expect(Object.keys(failure.latest as object).sort()).toEqual([
      "draftRevision",
      "draftUpdatedAt",
      "profileRevision",
      "profileUpdatedAt",
    ]);
    expect(JSON.stringify(failure.latest)).not.toMatch(
      /Session [AB]|proposalPayload/u,
    );

    const stored = state.proposalPayload as {
      scalars: Array<{ value: string }>;
      experiences: Array<{
        value: { title: string; company: string };
      }>;
    };
    expect([
      {
        headline: "Session A headline",
        title: "Session A role",
        company: "Example Laboratory",
      },
      {
        headline: "Session B headline",
        title: "Engineer",
        company: "Session B company",
      },
    ]).toContainEqual({
      headline: stored.scalars[0]?.value,
      title: stored.experiences[0]?.value.title,
      company: stored.experiences[0]?.value.company,
    });
    expect(state.revision).toBe(1);

    await expect(
      service.save(seeded.accountId, seeded.draftId, {
        baseDraftRevision: 0,
        reviewedProfileRevision: 0,
        proposals: sessionA.proposals,
        reviewDecisions: {
          ...sessionA.reviewDecisions,
          reviewComplete: true,
        },
      }),
    ).rejects.toMatchObject({ code: "DRAFT_REVISION_CONFLICT" });
    expect(
      await pool
        .query(`SELECT "revision" FROM "CvDraft" WHERE "id" = $1`, [
          seeded.draftId,
        ])
        .then((result) => result.rows[0].revision),
    ).toBe(1);
  });

  it("serializes save against confirm so exactly one stale-revision operation commits", async () => {
    const client = await pool.connect();
    const seeded = await seedReviewDraft(client, "save-confirm-order", {
      reviewSaved: true,
    });
    accounts.push(seeded.accountId);
    client.release();

    const service = new CvDraftComparisonService();
    const comparison = await service.get(seeded.accountId, seeded.draftId);
    comparison.proposals.scalars[0]!.value = "Save race winner";
    const outcomes = await Promise.allSettled([
      service.save(seeded.accountId, seeded.draftId, {
        baseDraftRevision: 0,
        reviewedProfileRevision: 0,
        proposals: comparison.proposals,
        reviewDecisions: comparison.reviewDecisions,
      }),
      new PrismaCvConfirmationRepository().confirm({
        accountId: seeded.accountId,
        draftId: seeded.draftId,
        idempotencyDigest: randomBytes(32),
        draftRevision: 0,
        sourceProfileRevision: 0,
        reviewedProfileRevision: 0,
        now: cvReviewFixtureNow,
      }),
    ]);
    expect(
      outcomes.filter((outcome) => outcome.status === "fulfilled"),
    ).toHaveLength(1);

    const state = await pool.query<{
      draftRevision: number;
      draftStatus: string;
      profileRevision: number;
      receipts: number;
      audits: number;
    }>(
      `SELECT draft."revision" AS "draftRevision",
              draft."status"::text AS "draftStatus",
              profile."revision" AS "profileRevision",
              (SELECT count(*)::int FROM "CvImportConfirmation" receipt
                WHERE receipt."draftId" = draft."id") AS receipts,
              (SELECT count(*)::int FROM "AuditEvent" audit
                WHERE audit."actorUserId" = draft."accountId"
                  AND audit."action" = 'cv_import.confirmed') AS audits
         FROM "CvDraft" draft
         JOIN "CandidateProfile" profile ON profile."id" = draft."profileId"
        WHERE draft."id" = $1`,
      [seeded.draftId],
    );
    expect([
      {
        draftRevision: 1,
        draftStatus: "EDITABLE",
        profileRevision: 0,
        receipts: 0,
        audits: 0,
      },
      {
        draftRevision: 0,
        draftStatus: "CONFIRMED",
        profileRevision: 1,
        receipts: 1,
        audits: 1,
      },
    ]).toContainEqual(state.rows[0]);
  });
});
