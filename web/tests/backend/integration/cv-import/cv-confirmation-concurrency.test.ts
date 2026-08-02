import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { CvDraftComparisonService } from "@/backend/services/cv-import/cv-draft-comparison-service";
import { PrismaCvConfirmationRepository } from "@/backend/repositories/cv-import/prisma-cv-confirmation-repository";
import {
  cleanupReviewAccounts,
  cvReviewFixtureDecisions,
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

function confirmationInput(
  seeded: Awaited<ReturnType<typeof seedReviewDraft>>,
) {
  return {
    accountId: seeded.accountId,
    draftId: seeded.draftId,
    draftRevision: 0,
    sourceProfileRevision: 0,
    reviewedProfileRevision: 0,
    now: cvReviewFixtureNow,
  };
}

async function expectOneRevision(profileId: string) {
  const state = await pool.query(
    `SELECT profile."revision", count(receipt."id")::int AS receipts
       FROM "CandidateProfile" profile
       LEFT JOIN "CvImportConfirmation" receipt ON receipt."profileId" = profile."id"
      WHERE profile."id" = $1 GROUP BY profile."revision"`,
    [profileId],
  );
  expect(state.rows[0]).toMatchObject({ revision: 1, receipts: 1 });
}

describe.sequential("CV confirmation concurrency", () => {
  it("allows one winner and exactly one Profile revision", async () => {
    const client = await pool.connect();
    const seeded = await seedReviewDraft(client, "race", { reviewSaved: true });
    accounts.push(seeded.accountId);
    client.release();
    const base = confirmationInput(seeded);
    const outcomes = await Promise.allSettled([
      new PrismaCvConfirmationRepository().confirm({
        ...base,
        idempotencyDigest: randomBytes(32),
      }),
      new PrismaCvConfirmationRepository().confirm({
        ...base,
        idempotencyDigest: randomBytes(32),
      }),
    ]);
    const failures = outcomes
      .filter((outcome) => outcome.status === "rejected")
      .map((outcome) => String(outcome.reason));
    expect(
      outcomes.filter((outcome) => outcome.status === "fulfilled"),
      failures.join("\n"),
    ).toHaveLength(1);
    await expectOneRevision(seeded.profileId);
  });

  it("replays simultaneous duplicate confirmations without a second mutation", async () => {
    const client = await pool.connect();
    const seeded = await seedReviewDraft(client, "duplicate-race", {
      reviewSaved: true,
    });
    accounts.push(seeded.accountId);
    client.release();
    const digest = randomBytes(32);
    const input = { ...confirmationInput(seeded), idempotencyDigest: digest };
    const outcomes = await Promise.all([
      new PrismaCvConfirmationRepository().confirm(input),
      new PrismaCvConfirmationRepository().confirm(input),
    ]);
    expect(outcomes.filter((outcome) => outcome.replayed)).toHaveLength(1);
    expect(outcomes[0].receipt.receiptId).toBe(outcomes[1].receipt.receiptId);
    await expectOneRevision(seeded.profileId);
  });

  it("serializes save versus confirm and permits only one stale-revision winner", async () => {
    const client = await pool.connect();
    const seeded = await seedReviewDraft(client, "save-confirm-race", {
      reviewSaved: true,
    });
    accounts.push(seeded.accountId);
    client.release();
    const service = new CvDraftComparisonService();
    const comparison = await service.get(seeded.accountId, seeded.draftId);
    const outcomes = await Promise.allSettled([
      service.save(seeded.accountId, seeded.draftId, {
        baseDraftRevision: 0,
        reviewedProfileRevision: 0,
        proposals: comparison.proposals,
        reviewDecisions: comparison.reviewDecisions,
      }),
      new PrismaCvConfirmationRepository().confirm({
        ...confirmationInput(seeded),
        idempotencyDigest: randomBytes(32),
      }),
    ]);
    expect(
      outcomes.filter((outcome) => outcome.status === "fulfilled"),
    ).toHaveLength(1);
    const state = await pool.query(
      `SELECT profile."revision", draft."revision" AS draft_revision, draft."status"::text AS draft_status
         FROM "CandidateProfile" profile JOIN "CvDraft" draft ON draft."profileId" = profile."id"
        WHERE profile."id" = $1`,
      [seeded.profileId],
    );
    expect(
      (state.rows[0].revision === 1 &&
        state.rows[0].draft_status === "CONFIRMED") ||
        (state.rows[0].revision === 0 && state.rows[0].draft_revision === 1),
    ).toBe(true);
  });

  it("serializes direct Profile CAS versus confirm with one revision winner", async () => {
    const client = await pool.connect();
    const seeded = await seedReviewDraft(client, "profile-confirm-race", {
      reviewSaved: true,
    });
    accounts.push(seeded.accountId);
    client.release();
    const directProfileSave = async () => {
      const direct = await pool.connect();
      try {
        await direct.query("BEGIN");
        const changed = await direct.query(
          `UPDATE "CandidateProfile"
              SET "headline" = 'Direct edit', "revision" = "revision" + 1, "updatedAt" = $2
            WHERE "id" = $1 AND "revision" = 0`,
          [seeded.profileId, cvReviewFixtureNow],
        );
        if (changed.rowCount !== 1)
          throw new Error("PROFILE_REVISION_CONFLICT");
        await direct.query("COMMIT");
      } catch (error) {
        await direct.query("ROLLBACK");
        throw error;
      } finally {
        direct.release();
      }
    };
    const outcomes = await Promise.allSettled([
      directProfileSave(),
      new PrismaCvConfirmationRepository().confirm({
        ...confirmationInput(seeded),
        idempotencyDigest: randomBytes(32),
      }),
    ]);
    expect(
      outcomes.filter((outcome) => outcome.status === "fulfilled"),
    ).toHaveLength(1);
    const profile = await pool.query(
      `SELECT "revision" FROM "CandidateProfile" WHERE "id" = $1`,
      [seeded.profileId],
    );
    expect(profile.rows[0].revision).toBe(1);
  });

  it("denies naturally expired or physically deleted source content without mutation", async () => {
    for (const mode of ["expired", "deleted"] as const) {
      const client = await pool.connect();
      const seeded = await seedReviewDraft(client, `source-${mode}`, {
        reviewSaved: true,
      });
      accounts.push(seeded.accountId);
      client.release();
      if (mode === "deleted")
        await pool.query(
          `UPDATE "CvStoredArtifact"
              SET "status" = 'DELETED', "contentInaccessibleAt" = $2,
                  "deleteAfter" = $2, "deletedAt" = $2, "updatedAt" = $2
            WHERE "id" = $1`,
          [seeded.sourceId, cvReviewFixtureNow],
        );
      await expect(
        new PrismaCvConfirmationRepository().confirm({
          ...confirmationInput(seeded),
          idempotencyDigest: randomBytes(32),
          now:
            mode === "expired"
              ? new Date(cvReviewFixtureNow.getTime() + 31 * 86_400_000)
              : cvReviewFixtureNow,
        }),
      ).rejects.toMatchObject({ code: "IMPORT_STATE_CONFLICT" });
      const state = await pool.query(
        `SELECT profile."revision", count(receipt."id")::int AS receipts
           FROM "CandidateProfile" profile
           LEFT JOIN "CvImportConfirmation" receipt ON receipt."profileId" = profile."id"
          WHERE profile."id" = $1 GROUP BY profile."revision"`,
        [seeded.profileId],
      );
      expect(state.rows[0]).toMatchObject({ revision: 0, receipts: 0 });
    }
  });

  it("rolls back when a saved replacement target disappears", async () => {
    const client = await pool.connect();
    const seeded = await seedReviewDraft(client, "deleted-target", {
      reviewSaved: true,
    });
    accounts.push(seeded.accountId);
    const targetId = `target-${seeded.profileId}`;
    await client.query(
      `INSERT INTO "ProfileExperience" ("id", "profileId", "position", "title", "company", "startDate", "endDate", "isCurrent", "createdAt", "updatedAt")
       VALUES ($1, $2, 0, 'Old role', 'Old company', DATE '2020-01-01', DATE '2021-01-01', false, $3, $3)`,
      [targetId, seeded.profileId, cvReviewFixtureNow],
    );
    await client.query(
      `UPDATE "CvDraft" SET "reviewPayload" = $2::jsonb WHERE "id" = $1`,
      [
        seeded.draftId,
        JSON.stringify({
          ...cvReviewFixtureDecisions,
          experiences: [
            {
              proposalId: "proposal_experience_fixture",
              action: "REPLACE",
              targetId,
            },
          ],
        }),
      ],
    );
    await client.query(`DELETE FROM "ProfileExperience" WHERE "id" = $1`, [
      targetId,
    ]);
    client.release();
    await expect(
      new PrismaCvConfirmationRepository().confirm({
        ...confirmationInput(seeded),
        idempotencyDigest: randomBytes(32),
      }),
    ).rejects.toMatchObject({ code: "PROFILE_REVISION_CONFLICT" });
    const profile = await pool.query(
      `SELECT "headline", "revision" FROM "CandidateProfile" WHERE "id" = $1`,
      [seeded.profileId],
    );
    expect(profile.rows[0]).toMatchObject({ headline: null, revision: 0 });
  });
});
