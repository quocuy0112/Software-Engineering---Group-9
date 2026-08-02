import { randomBytes } from "node:crypto";

import { Pool } from "pg";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { PrismaCvConfirmationRepository } from "@/backend/repositories/cv-import/prisma-cv-confirmation-repository";
import { PrismaProfileCommandRepository } from "@/backend/repositories/profile/prisma-profile-command-repository";
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

async function profileState(profileId: string, draftId: string) {
  return pool
    .query<{
      headline: string | null;
      profileRevision: number;
      profileUpdatedAt: Date;
      draftRevision: number;
      draftUpdatedAt: Date;
      draftStatus: string;
      receipts: number;
      audits: number;
    }>(
      `SELECT profile."headline", profile."revision" AS "profileRevision",
              profile."updatedAt" AS "profileUpdatedAt",
              draft."revision" AS "draftRevision",
              draft."updatedAt" AS "draftUpdatedAt",
              draft."status"::text AS "draftStatus",
              (SELECT count(*)::int FROM "CvImportConfirmation" receipt
                WHERE receipt."draftId" = draft."id") AS receipts,
              (SELECT count(*)::int FROM "AuditEvent" audit
                WHERE audit."actorUserId" = draft."accountId"
                  AND audit."action" = 'cv_import.confirmed') AS audits
         FROM "CandidateProfile" profile
         JOIN "CvDraft" draft ON draft."profileId" = profile."id"
        WHERE profile."id" = $1 AND draft."id" = $2`,
      [profileId, draftId],
    )
    .then((result) => result.rows[0]!);
}

describe.sequential("CV Profile review conflicts", () => {
  it("rejects a stale Profile save, returns safe metadata, then permits explicit fresh re-review", async () => {
    const client = await pool.connect();
    const seeded = await seedReviewDraft(client, "direct-profile-save");
    accounts.push(seeded.accountId);
    client.release();

    const service = new CvDraftComparisonService();
    const stale = await service.get(seeded.accountId, seeded.draftId);
    stale.proposals.scalars[0]!.value = "Unsaved CV headline";
    await new PrismaProfileCommandRepository().saveSection(seeded.accountId, {
      section: "basics",
      baseRevision: 0,
      basics: {
        headline: "Direct Profile edit",
        summary: null,
        phone: null,
        location: null,
      },
    });
    const changed = await profileState(seeded.profileId, seeded.draftId);

    await expect(
      service.save(seeded.accountId, seeded.draftId, {
        baseDraftRevision: 0,
        reviewedProfileRevision: 0,
        proposals: stale.proposals,
        reviewDecisions: {
          ...stale.reviewDecisions,
          reviewComplete: true,
        },
      }),
    ).rejects.toMatchObject({
      code: "PROFILE_REVISION_CONFLICT",
      latest: {
        draftRevision: 0,
        profileRevision: 1,
        draftUpdatedAt: changed.draftUpdatedAt.toISOString(),
        profileUpdatedAt: changed.profileUpdatedAt.toISOString(),
      },
    });
    expect(await profileState(seeded.profileId, seeded.draftId)).toMatchObject({
      headline: "Direct Profile edit",
      profileRevision: 1,
      draftRevision: 0,
      receipts: 0,
      audits: 0,
    });

    const fresh = await service.get(seeded.accountId, seeded.draftId);
    expect(fresh).toMatchObject({
      reviewedProfileRevision: 0,
      currentProfile: { revision: 1, headline: "Direct Profile edit" },
    });
    fresh.proposals.scalars[0]!.value = "Explicitly re-reviewed CV headline";
    fresh.reviewDecisions = {
      ...fresh.reviewDecisions,
      reviewComplete: true,
      scalars: fresh.reviewDecisions.scalars.map((decision) => ({
        ...decision,
        action: "REPLACE" as const,
      })),
    };
    await expect(
      service.save(seeded.accountId, seeded.draftId, {
        baseDraftRevision: 0,
        reviewedProfileRevision: 1,
        proposals: fresh.proposals,
        reviewDecisions: fresh.reviewDecisions,
      }),
    ).resolves.toMatchObject({
      draftRevision: 1,
      reviewedProfileRevision: 1,
    });
    await expect(
      new PrismaCvConfirmationRepository().confirm({
        accountId: seeded.accountId,
        draftId: seeded.draftId,
        idempotencyDigest: randomBytes(32),
        draftRevision: 1,
        sourceProfileRevision: 0,
        reviewedProfileRevision: 1,
        now: cvReviewFixtureNow,
      }),
    ).resolves.toMatchObject({
      replayed: false,
      receipt: { profileRevisionBefore: 1, profileRevisionAfter: 2 },
    });
    expect(await profileState(seeded.profileId, seeded.draftId)).toMatchObject({
      headline: "Explicitly re-reviewed CV headline",
      profileRevision: 2,
      draftRevision: 1,
      draftStatus: "CONFIRMED",
      receipts: 1,
      audits: 1,
    });
  });

  it("rejects every reviewed/current/source revision mismatch without a partial confirmation", async () => {
    const client = await pool.connect();
    const seeded = await seedReviewDraft(client, "revision-mismatch", {
      reviewSaved: true,
    });
    accounts.push(seeded.accountId);
    client.release();

    await new PrismaProfileCommandRepository().saveSection(seeded.accountId, {
      section: "basics",
      baseRevision: 0,
      basics: {
        headline: "Direct winner",
        summary: null,
        phone: null,
        location: null,
      },
    });
    const repository = new PrismaCvConfirmationRepository();
    const changed = await profileState(seeded.profileId, seeded.draftId);
    for (const revisions of [
      {
        draftRevision: 0,
        sourceProfileRevision: 0,
        reviewedProfileRevision: 0,
      },
      {
        draftRevision: 0,
        sourceProfileRevision: 1,
        reviewedProfileRevision: 1,
      },
    ])
      await expect(
        repository.confirm({
          accountId: seeded.accountId,
          draftId: seeded.draftId,
          idempotencyDigest: randomBytes(32),
          ...revisions,
          now: cvReviewFixtureNow,
        }),
      ).rejects.toMatchObject({
        code: "PROFILE_REVISION_CONFLICT",
        latest: {
          draftRevision: 0,
          profileRevision: 1,
          draftUpdatedAt: changed.draftUpdatedAt.toISOString(),
          profileUpdatedAt: changed.profileUpdatedAt.toISOString(),
        },
      });

    expect(await profileState(seeded.profileId, seeded.draftId)).toMatchObject({
      headline: "Direct winner",
      profileRevision: 1,
      draftRevision: 0,
      draftStatus: "EDITABLE",
      receipts: 0,
      audits: 0,
    });
  });

  it("rejects a deleted replacement target even when the caller names the current Profile revision", async () => {
    const client = await pool.connect();
    const seeded = await seedReviewDraft(client, "deleted-replacement");
    accounts.push(seeded.accountId);
    const targetId = `replacement-${seeded.profileId}`;
    await client.query(
      `INSERT INTO "ProfileExperience" (
        "id", "profileId", "position", "title", "company", "startDate",
        "endDate", "isCurrent", "createdAt", "updatedAt"
      ) VALUES ($1, $2, 0, 'Old role', 'Old company', DATE '2020-01-01',
        DATE '2021-01-01', false, $3, $3)`,
      [targetId, seeded.profileId, cvReviewFixtureNow],
    );
    client.release();

    const service = new CvDraftComparisonService();
    const stale = await service.get(seeded.accountId, seeded.draftId);
    stale.reviewDecisions = {
      ...stale.reviewDecisions,
      reviewComplete: true,
      experiences: [
        {
          proposalId: "proposal_experience_fixture",
          action: "REPLACE",
          targetId,
        },
      ],
    };
    await new PrismaProfileCommandRepository().saveSection(seeded.accountId, {
      section: "experience",
      baseRevision: 0,
      experience: [],
    });
    const changed = await profileState(seeded.profileId, seeded.draftId);

    await expect(
      service.save(seeded.accountId, seeded.draftId, {
        baseDraftRevision: 0,
        reviewedProfileRevision: 1,
        proposals: stale.proposals,
        reviewDecisions: stale.reviewDecisions,
      }),
    ).rejects.toMatchObject({
      code: "PROFILE_REVISION_CONFLICT",
      latest: {
        draftRevision: 0,
        profileRevision: 1,
        draftUpdatedAt: changed.draftUpdatedAt.toISOString(),
        profileUpdatedAt: changed.profileUpdatedAt.toISOString(),
      },
    });
    expect(await profileState(seeded.profileId, seeded.draftId)).toMatchObject({
      profileRevision: 1,
      draftRevision: 0,
      receipts: 0,
      audits: 0,
    });
  });

  it("rejects confirmation when a replacement target changed after the saved review", async () => {
    const client = await pool.connect();
    const seeded = await seedReviewDraft(client, "changed-replacement");
    accounts.push(seeded.accountId);
    const targetId = `changed-${seeded.profileId}`;
    await client.query(
      `INSERT INTO "ProfileExperience" (
        "id", "profileId", "position", "title", "company", "startDate",
        "endDate", "isCurrent", "createdAt", "updatedAt"
      ) VALUES ($1, $2, 0, 'Reviewed role', 'Reviewed company', DATE '2020-01-01',
        DATE '2021-01-01', false, $3, $3)`,
      [targetId, seeded.profileId, cvReviewFixtureNow],
    );
    client.release();

    const service = new CvDraftComparisonService();
    const comparison = await service.get(seeded.accountId, seeded.draftId);
    await service.save(seeded.accountId, seeded.draftId, {
      baseDraftRevision: 0,
      reviewedProfileRevision: 0,
      proposals: comparison.proposals,
      reviewDecisions: {
        ...comparison.reviewDecisions,
        reviewComplete: true,
        experiences: [
          {
            proposalId: "proposal_experience_fixture",
            action: "REPLACE",
            targetId,
          },
        ],
      },
    });
    await new PrismaProfileCommandRepository().saveSection(seeded.accountId, {
      section: "experience",
      baseRevision: 0,
      experience: [
        {
          id: targetId,
          title: "Direct changed role",
          company: "Direct changed company",
          description: null,
          startDate: "2022-01-01",
          endDate: null,
          current: true,
        },
      ],
    });
    const changed = await profileState(seeded.profileId, seeded.draftId);

    await expect(
      new PrismaCvConfirmationRepository().confirm({
        accountId: seeded.accountId,
        draftId: seeded.draftId,
        idempotencyDigest: randomBytes(32),
        draftRevision: 1,
        sourceProfileRevision: 0,
        reviewedProfileRevision: 0,
        now: cvReviewFixtureNow,
      }),
    ).rejects.toMatchObject({
      code: "PROFILE_REVISION_CONFLICT",
      latest: {
        draftRevision: 1,
        profileRevision: 1,
        draftUpdatedAt: changed.draftUpdatedAt.toISOString(),
        profileUpdatedAt: changed.profileUpdatedAt.toISOString(),
      },
    });
    expect(await profileState(seeded.profileId, seeded.draftId)).toMatchObject({
      profileRevision: 1,
      draftRevision: 1,
      draftStatus: "EDITABLE",
      receipts: 0,
      audits: 0,
    });
    expect(
      await pool
        .query(
          `SELECT "title", "company" FROM "ProfileExperience" WHERE "id" = $1`,
          [targetId],
        )
        .then((result) => result.rows[0]),
    ).toMatchObject({
      title: "Direct changed role",
      company: "Direct changed company",
    });
  });

  it("replays only the exact successful confirmation after later direct Profile edits", async () => {
    const client = await pool.connect();
    const seeded = await seedReviewDraft(client, "stale-confirm-replay", {
      reviewSaved: true,
    });
    accounts.push(seeded.accountId);
    client.release();

    const repository = new PrismaCvConfirmationRepository();
    const digest = randomBytes(32);
    const input = {
      accountId: seeded.accountId,
      draftId: seeded.draftId,
      idempotencyDigest: digest,
      draftRevision: 0,
      sourceProfileRevision: 0,
      reviewedProfileRevision: 0,
      now: cvReviewFixtureNow,
    };
    const winner = await repository.confirm(input);
    await new PrismaProfileCommandRepository().saveSection(seeded.accountId, {
      section: "basics",
      baseRevision: 1,
      basics: {
        headline: "Later direct edit",
        summary: null,
        phone: null,
        location: null,
      },
    });
    await expect(repository.confirm(input)).resolves.toEqual({
      ...winner,
      replayed: true,
    });
    await expect(
      repository.confirm({ ...input, reviewedProfileRevision: 1 }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });
    expect(await profileState(seeded.profileId, seeded.draftId)).toMatchObject({
      headline: "Later direct edit",
      profileRevision: 2,
      receipts: 1,
      audits: 1,
    });
  });

  it("rolls Profile, children, receipt, draft, and audit back as one unit", async () => {
    const client = await pool.connect();
    const seeded = await seedReviewDraft(client, "conflict-rollback", {
      reviewSaved: true,
    });
    accounts.push(seeded.accountId);
    client.release();

    await expect(
      new PrismaCvConfirmationRepository((point) => {
        if (point === "after-experiences")
          throw new Error("US4_ROLLBACK_FIXTURE");
      }).confirm({
        accountId: seeded.accountId,
        draftId: seeded.draftId,
        idempotencyDigest: randomBytes(32),
        draftRevision: 0,
        sourceProfileRevision: 0,
        reviewedProfileRevision: 0,
        now: cvReviewFixtureNow,
      }),
    ).rejects.toThrow("US4_ROLLBACK_FIXTURE");
    expect(await profileState(seeded.profileId, seeded.draftId)).toMatchObject({
      headline: null,
      profileRevision: 0,
      draftRevision: 0,
      draftStatus: "EDITABLE",
      receipts: 0,
      audits: 0,
    });
    expect(
      await pool
        .query(
          `SELECT count(*)::int AS count FROM "ProfileExperience" WHERE "profileId" = $1`,
          [seeded.profileId],
        )
        .then((result) => result.rows[0].count),
    ).toBe(0);
  });
});
