import "server-only";

import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

import { prisma } from "@/backend/database/prisma";
import { CvImportServiceError } from "@/backend/services/cv-import/cv-http-errors";
import {
  normalizeSkillName,
  normalizeSocialUrl,
  ProfileValidationError,
} from "@/backend/services/profile/profile-validation";
import { canonicalJson } from "@/shared/contracts/cv-import/common";
import {
  assertCompleteReview,
  cvConfirmationReceiptSchema,
  cvEditableProposalsSchema,
  cvReviewDecisionsSchema,
  type CvEditableProposals,
  type CvReviewDecisions,
} from "@/shared/contracts/cv-import/review";

type FailurePoint = (point: string) => void;

const confirmationProjection = {
  id: true,
  accountId: true,
  profileId: true,
  uploadId: true,
  draftId: true,
  confirmedAt: true,
  draftRevision: true,
  sourceProfileRevision: true,
  reviewedProfileRevision: true,
  profileRevisionBefore: true,
  profileRevisionAfter: true,
  appliedScalarCount: true,
  appliedExperienceCount: true,
  appliedEducationCount: true,
  appliedSkillCount: true,
  appliedSocialLinkCount: true,
  selectionManifestVersion: true,
  selectionManifest: true,
} as const;

type ConfirmInput = Readonly<{
  accountId: string;
  draftId: string;
  idempotencyDigest: Uint8Array;
  draftRevision: number;
  sourceProfileRevision: number;
  reviewedProfileRevision: number;
  now: Date;
}>;

type ConfirmationBindingRow = Readonly<{
  draftId: string;
  draftRevision: number;
  sourceProfileRevision: number;
  reviewedProfileRevision: number;
  profileRevisionBefore: number;
  profileRevisionAfter: number;
  appliedScalarCount: number;
  appliedExperienceCount: number;
  appliedEducationCount: number;
  appliedSkillCount: number;
  appliedSocialLinkCount: number;
  selectionManifestVersion: string;
  selectionManifestDigest: Uint8Array;
  selectionManifest: unknown;
}>;

function receipt(row: {
  id: string;
  uploadId: string;
  draftId: string;
  confirmedAt: Date;
  draftRevision: number;
  sourceProfileRevision: number;
  reviewedProfileRevision: number;
  profileRevisionBefore: number;
  profileRevisionAfter: number;
  appliedScalarCount: number;
  appliedExperienceCount: number;
  appliedEducationCount: number;
  appliedSkillCount: number;
  appliedSocialLinkCount: number;
}) {
  return cvConfirmationReceiptSchema.parse({
    receiptId: row.id,
    uploadId: row.uploadId,
    draftId: row.draftId,
    confirmedAt: row.confirmedAt.toISOString(),
    draftRevision: row.draftRevision,
    sourceProfileRevision: row.sourceProfileRevision,
    reviewedProfileRevision: row.reviewedProfileRevision,
    profileRevisionBefore: row.profileRevisionBefore,
    profileRevisionAfter: row.profileRevisionAfter,
    appliedCounts: {
      scalars: row.appliedScalarCount,
      experiences: row.appliedExperienceCount,
      education: row.appliedEducationCount,
      skills: row.appliedSkillCount,
      socialLinks: row.appliedSocialLinkCount,
    },
  });
}

function manifestMatchesReceipt(row: ConfirmationBindingRow): boolean {
  try {
    if (
      row.selectionManifestVersion !== "cv-selection-v1" ||
      row.selectionManifestDigest.byteLength !== 32 ||
      !row.selectionManifest ||
      typeof row.selectionManifest !== "object"
    )
      return false;
    const manifest = row.selectionManifest as Record<string, unknown>;
    const decisions = cvReviewDecisionsSchema.safeParse(manifest.decisions);
    const counts = manifest.counts as Record<string, unknown> | undefined;
    if (
      manifest.version !== row.selectionManifestVersion ||
      !decisions.success ||
      !counts ||
      counts.scalars !== row.appliedScalarCount ||
      counts.experiences !== row.appliedExperienceCount ||
      counts.education !== row.appliedEducationCount ||
      counts.skills !== row.appliedSkillCount ||
      counts.socialLinks !== row.appliedSocialLinkCount
    )
      return false;
    const digest = createHash("sha256")
      .update(canonicalJson(row.selectionManifest), "utf8")
      .digest();
    return timingSafeEqual(digest, row.selectionManifestDigest);
  } catch {
    return false;
  }
}

function assertConfirmationBinding(
  row: ConfirmationBindingRow,
  input: ConfirmInput,
) {
  if (
    row.draftId !== input.draftId ||
    row.draftRevision !== input.draftRevision ||
    row.sourceProfileRevision !== input.sourceProfileRevision ||
    row.reviewedProfileRevision !== input.reviewedProfileRevision ||
    row.profileRevisionBefore !== input.reviewedProfileRevision ||
    row.profileRevisionAfter !== row.profileRevisionBefore + 1 ||
    !manifestMatchesReceipt(row)
  )
    throw new CvImportServiceError("IDEMPOTENCY_KEY_REUSED");
}

function hydrateStored(stored: unknown): CvEditableProposals {
  if (!stored || typeof stored !== "object")
    throw new CvImportServiceError("CV_DRAFT_NOT_FOUND");
  const evidence = {
    confidence: null,
    locations: [],
    contextAvailable: false,
    context: null,
  } as const;
  return cvEditableProposalsSchema.parse(
    Object.fromEntries(
      Object.entries(stored as Record<string, unknown>).map(
        ([group, values]) => [
          group,
          Array.isArray(values)
            ? values.map((value) => ({ ...(value as object), evidence }))
            : values,
        ],
      ),
    ),
  );
}

function decisionMap<T extends { proposalId: string }>(values: readonly T[]) {
  return new Map(values.map((value) => [value.proposalId, value]));
}

function assertUniqueTargets(decisions: CvReviewDecisions) {
  for (const group of [
    decisions.experiences,
    decisions.education,
    decisions.socialLinks,
  ]) {
    const targets = group.flatMap((decision) =>
      decision.targetId ? [decision.targetId] : [],
    );
    if (new Set(targets).size !== targets.length)
      throw new CvImportServiceError("VALIDATION_ERROR");
  }
}

function isRetryableTransactionConflict(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return (
    candidate.code === "P2034" ||
    (typeof candidate.message === "string" &&
      /write conflict|deadlock|serialization failure/u.test(candidate.message))
  );
}

function reviewValidationError(
  path: string,
  error: unknown,
): CvImportServiceError {
  if (error instanceof ProfileValidationError) {
    return new CvImportServiceError("VALIDATION_ERROR", {
      fieldErrors: [
        {
          path,
          code: error.code,
          message: "Enter a valid value.",
        },
      ],
    });
  }
  throw error;
}

export class PrismaCvConfirmationRepository {
  constructor(private readonly failurePoint: FailurePoint = () => undefined) {}

  async confirm(input: ConfirmInput) {
    if (input.idempotencyDigest.byteLength !== 32)
      throw new CvImportServiceError("VALIDATION_ERROR");
    const digest = Uint8Array.from(input.idempotencyDigest);
    const operation = async () =>
      prisma.$transaction(
        async (transaction) => {
          const existing = await transaction.cvImportConfirmation.findFirst({
            where: { accountId: input.accountId, idempotencyDigest: digest },
            select: confirmationProjection,
          });
          if (existing) {
            const digestRows = await transaction.$queryRaw<
              Array<{ digestHex: string }>
            >`
              SELECT encode("selectionManifestDigest", 'hex') AS "digestHex"
                FROM "CvImportConfirmation" WHERE "id" = ${existing.id}
            `;
            const storedDigest = digestRows[0]?.digestHex;
            if (!storedDigest)
              throw new CvImportServiceError("IDEMPOTENCY_KEY_REUSED");
            assertConfirmationBinding(
              {
                ...existing,
                selectionManifestDigest: Uint8Array.from(
                  Buffer.from(storedDigest, "hex"),
                ),
              },
              input,
            );
            return { receipt: receipt(existing), replayed: true } as const;
          }
          const locations = await transaction.$queryRaw<
            Array<{
              profileId: string;
              uploadId: string;
              sourceId: string;
            }>
          >`
            SELECT draft."profileId", draft."uploadId", source."id" AS "sourceId"
              FROM "CvDraft" draft
              JOIN "CandidateProfile" profile ON profile."id" = draft."profileId"
              JOIN "CvUpload" upload ON upload."id" = draft."uploadId"
              JOIN "CvStoredArtifact" source
                ON source."uploadId" = upload."id" AND source."kind" = 'SOURCE_DOCUMENT'
              JOIN "user" account ON account."id" = draft."accountId"
             WHERE draft."id" = ${input.draftId}
               AND draft."accountId" = ${input.accountId}
               AND profile."candidateUserId" = ${input.accountId}
               AND upload."accountId" = ${input.accountId}
               AND upload."profileId" = draft."profileId"
               AND source."accountId" = ${input.accountId}
               AND account."state" = 'ACTIVE'
               AND account."deletedAt" IS NULL
          `;
          const location = locations[0];
          if (!location) throw new CvImportServiceError("CV_DRAFT_NOT_FOUND");

          // Keep this order identical to draft save and compatible with the
          // Feature 002 parent-Profile lock before any aggregate child writes.
          const profiles = await transaction.$queryRaw<
            Array<{
              profileId: string;
              profileRevision: number;
              profileUpdatedAt: Date;
            }>
          >`
            SELECT profile."id" AS "profileId",
                   profile."revision" AS "profileRevision",
                   profile."updatedAt" AS "profileUpdatedAt"
              FROM "CandidateProfile" profile
             WHERE profile."id" = ${location.profileId}
               AND profile."candidateUserId" = ${input.accountId}
             FOR UPDATE OF profile
          `;
          const profileLock = profiles[0];
          if (!profileLock)
            throw new CvImportServiceError("CV_DRAFT_NOT_FOUND");

          const uploads = await transaction.$queryRaw<
            Array<{
              uploadId: string;
              uploadStatus: string;
              uploadExpiresAt: Date;
              uploadContentInaccessibleAt: Date | null;
              uploadDeletedAt: Date | null;
            }>
          >`
            SELECT upload."id" AS "uploadId",
                   upload."status"::text AS "uploadStatus",
                   upload."expiresAt" AS "uploadExpiresAt",
                   upload."contentInaccessibleAt" AS "uploadContentInaccessibleAt",
                   upload."deletedAt" AS "uploadDeletedAt"
              FROM "CvUpload" upload
             WHERE upload."id" = ${location.uploadId}
               AND upload."accountId" = ${input.accountId}
               AND upload."profileId" = ${location.profileId}
             FOR UPDATE OF upload
          `;
          const uploadLock = uploads[0];
          if (!uploadLock) throw new CvImportServiceError("CV_DRAFT_NOT_FOUND");

          const drafts = await transaction.$queryRaw<
            Array<{
              draftId: string;
              draftRevision: number;
              draftUpdatedAt: Date;
              draftStatus: string;
              draftExpiresAt: Date;
              draftContentInaccessibleAt: Date | null;
              sourceProfileRevision: number;
              reviewedProfileRevision: number;
            }>
          >`
            SELECT draft."id" AS "draftId",
                   draft."revision" AS "draftRevision",
                   draft."updatedAt" AS "draftUpdatedAt",
                   draft."status"::text AS "draftStatus",
                   draft."expiresAt" AS "draftExpiresAt",
                   draft."contentInaccessibleAt" AS "draftContentInaccessibleAt",
                   draft."sourceProfileRevision", draft."reviewedProfileRevision"
              FROM "CvDraft" draft
             WHERE draft."id" = ${input.draftId}
               AND draft."accountId" = ${input.accountId}
               AND draft."profileId" = ${location.profileId}
               AND draft."uploadId" = ${location.uploadId}
             FOR UPDATE OF draft
          `;
          const draftLock = drafts[0];
          if (!draftLock) throw new CvImportServiceError("CV_DRAFT_NOT_FOUND");

          const sources = await transaction.$queryRaw<
            Array<{
              sourceStatus: string;
              sourceContentInaccessibleAt: Date | null;
              sourceDeletedAt: Date | null;
            }>
          >`
            SELECT source."status"::text AS "sourceStatus",
                   source."contentInaccessibleAt" AS "sourceContentInaccessibleAt",
                   source."deletedAt" AS "sourceDeletedAt"
              FROM "CvStoredArtifact" source
             WHERE source."id" = ${location.sourceId}
               AND source."uploadId" = ${location.uploadId}
               AND source."accountId" = ${input.accountId}
               AND source."kind" = 'SOURCE_DOCUMENT'
             FOR UPDATE OF source
          `;
          const sourceLock = sources[0];
          if (!sourceLock) throw new CvImportServiceError("CV_DRAFT_NOT_FOUND");
          const lock = {
            ...profileLock,
            ...uploadLock,
            ...draftLock,
            ...sourceLock,
          };
          const latest = {
            draftRevision: lock.draftRevision,
            profileRevision: lock.profileRevision,
            draftUpdatedAt: lock.draftUpdatedAt.toISOString(),
            profileUpdatedAt: lock.profileUpdatedAt.toISOString(),
          };
          if (
            lock.draftStatus !== "EDITABLE" ||
            lock.uploadStatus !== "REVIEW_READY" ||
            lock.draftContentInaccessibleAt !== null ||
            lock.uploadContentInaccessibleAt !== null ||
            lock.uploadDeletedAt !== null ||
            lock.sourceStatus !== "AVAILABLE" ||
            lock.sourceContentInaccessibleAt !== null ||
            lock.sourceDeletedAt !== null ||
            lock.draftExpiresAt <= input.now ||
            lock.uploadExpiresAt <= input.now
          )
            throw new CvImportServiceError("IMPORT_STATE_CONFLICT", { latest });
          if (lock.draftRevision !== input.draftRevision)
            throw new CvImportServiceError("DRAFT_REVISION_CONFLICT", {
              latest,
            });
          if (
            lock.sourceProfileRevision !== input.sourceProfileRevision ||
            lock.reviewedProfileRevision !== input.reviewedProfileRevision ||
            lock.profileRevision !== input.reviewedProfileRevision
          )
            throw new CvImportServiceError("PROFILE_REVISION_CONFLICT", {
              latest,
            });
          const draft = await transaction.cvDraft.findUnique({
            where: { id: input.draftId },
          });
          if (!draft?.proposalPayload || !draft.reviewPayload)
            throw new CvImportServiceError("VALIDATION_ERROR");
          const proposals = hydrateStored(draft.proposalPayload);
          const decisions = cvReviewDecisionsSchema.parse(draft.reviewPayload);
          if (!decisions.reviewComplete)
            throw new CvImportServiceError("VALIDATION_ERROR");
          try {
            assertCompleteReview({ proposals, decisions });
          } catch {
            throw new CvImportServiceError("VALIDATION_ERROR");
          }
          assertUniqueTargets(decisions);
          const experienceTargets = decisions.experiences.flatMap((decision) =>
            decision.action === "REPLACE" && decision.targetId
              ? [decision.targetId]
              : [],
          );
          const educationTargets = decisions.education.flatMap((decision) =>
            decision.action === "REPLACE" && decision.targetId
              ? [decision.targetId]
              : [],
          );
          const socialLinkTargets = decisions.socialLinks.flatMap((decision) =>
            decision.action === "REPLACE" && decision.targetId
              ? [decision.targetId]
              : [],
          );
          const lockedExperiences = experienceTargets.length
            ? await transaction.$queryRaw<Array<{ id: string }>>`
                SELECT "id" FROM "ProfileExperience"
                 WHERE "profileId" = ${lock.profileId}
                   AND "id" = ANY(${experienceTargets}::text[])
                 ORDER BY "id" FOR UPDATE
              `
            : [];
          const lockedEducation = educationTargets.length
            ? await transaction.$queryRaw<Array<{ id: string }>>`
                SELECT "id" FROM "ProfileEducation"
                 WHERE "profileId" = ${lock.profileId}
                   AND "id" = ANY(${educationTargets}::text[])
                 ORDER BY "id" FOR UPDATE
              `
            : [];
          const lockedSocialLinks = socialLinkTargets.length
            ? await transaction.$queryRaw<Array<{ id: string }>>`
                SELECT "id" FROM "SocialLink"
                 WHERE "profileId" = ${lock.profileId}
                   AND "id" = ANY(${socialLinkTargets}::text[])
                 ORDER BY "id" FOR UPDATE
              `
            : [];
          if (
            lockedExperiences.length !== experienceTargets.length ||
            lockedEducation.length !== educationTargets.length ||
            lockedSocialLinks.length !== socialLinkTargets.length
          )
            throw new CvImportServiceError("PROFILE_REVISION_CONFLICT", {
              latest,
            });
          const scalarDecisions = decisionMap(decisions.scalars);
          const experienceDecisions = decisionMap(decisions.experiences);
          const educationDecisions = decisionMap(decisions.education);
          const skillDecisions = decisionMap(decisions.skills);
          const linkDecisions = decisionMap(decisions.socialLinks);
          const counts = {
            scalars: 0,
            experiences: 0,
            education: 0,
            skills: 0,
            socialLinks: 0,
          };
          const scalarUpdate: Record<string, string> = {};
          for (const proposal of proposals.scalars) {
            const decision = scalarDecisions.get(proposal.proposalId);
            if (!decision || decision.action === "SKIP") continue;
            scalarUpdate[proposal.field] = proposal.value;
            counts.scalars += 1;
          }
          if (Object.keys(scalarUpdate).length)
            await transaction.candidateProfile.update({
              where: { id: lock.profileId },
              data: scalarUpdate,
            });
          this.failurePoint("after-scalars");

          const existingExperiences =
            await transaction.profileExperience.findMany({
              where: { profileId: lock.profileId },
              orderBy: { position: "asc" },
            });
          let experienceCount = existingExperiences.length;
          for (const proposal of proposals.experiences) {
            const decision = experienceDecisions.get(proposal.proposalId);
            if (!decision || decision.action === "SKIP") continue;
            const value = {
              title: proposal.value.title,
              company: proposal.value.company,
              description: proposal.value.description,
              startDate: new Date(`${proposal.value.startDate}T00:00:00.000Z`),
              endDate: proposal.value.endDate
                ? new Date(`${proposal.value.endDate}T00:00:00.000Z`)
                : null,
              isCurrent: proposal.value.isCurrent,
            };
            if (decision.action === "REPLACE" && decision.targetId) {
              const changed = await transaction.profileExperience.updateMany({
                where: { id: decision.targetId, profileId: lock.profileId },
                data: value,
              });
              if (changed.count !== 1)
                throw new CvImportServiceError("PROFILE_REVISION_CONFLICT", {
                  latest,
                });
            } else {
              if (experienceCount >= 50)
                throw new CvImportServiceError("VALIDATION_ERROR");
              await transaction.profileExperience.create({
                data: {
                  id: randomUUID(),
                  profileId: lock.profileId,
                  position: experienceCount,
                  ...value,
                },
              });
              experienceCount += 1;
            }
            counts.experiences += 1;
          }
          this.failurePoint("after-experiences");

          const existingEducation = await transaction.profileEducation.findMany(
            {
              where: { profileId: lock.profileId },
              orderBy: { position: "asc" },
            },
          );
          let educationCount = existingEducation.length;
          for (const proposal of proposals.education) {
            const decision = educationDecisions.get(proposal.proposalId);
            if (!decision || decision.action === "SKIP") continue;
            const value = {
              institution: proposal.value.institution,
              degree: proposal.value.degree,
              field: proposal.value.field,
              startDate: new Date(`${proposal.value.startDate}T00:00:00.000Z`),
              endDate: proposal.value.endDate
                ? new Date(`${proposal.value.endDate}T00:00:00.000Z`)
                : null,
              isCurrent: proposal.value.isCurrent,
            };
            if (decision.action === "REPLACE" && decision.targetId) {
              const changed = await transaction.profileEducation.updateMany({
                where: { id: decision.targetId, profileId: lock.profileId },
                data: value,
              });
              if (changed.count !== 1)
                throw new CvImportServiceError("PROFILE_REVISION_CONFLICT", {
                  latest,
                });
            } else {
              if (educationCount >= 50)
                throw new CvImportServiceError("VALIDATION_ERROR");
              await transaction.profileEducation.create({
                data: {
                  id: randomUUID(),
                  profileId: lock.profileId,
                  position: educationCount,
                  ...value,
                },
              });
              educationCount += 1;
            }
            counts.education += 1;
          }
          this.failurePoint("after-education");

          const existingSkills =
            await transaction.candidateProfileSkill.findMany({
              where: { profileId: lock.profileId },
              select: {
                skill: { select: { normalizedName: true } },
                position: true,
              },
            });
          const skillNames = new Set(
            existingSkills.map((entry) => entry.skill.normalizedName),
          );
          let skillPosition = existingSkills.length;
          for (const proposal of proposals.skills) {
            const decision = skillDecisions.get(proposal.proposalId);
            if (!decision || decision.action === "SKIP") continue;
            let normalized: ReturnType<typeof normalizeSkillName>;
            try {
              normalized = normalizeSkillName(proposal.value);
            } catch (error) {
              throw reviewValidationError(
                `proposals.skills.${proposals.skills.indexOf(proposal)}.value`,
                error,
              );
            }
            if (skillNames.has(normalized.normalizedName)) continue;
            if (skillPosition >= 50)
              throw new CvImportServiceError("VALIDATION_ERROR");
            const skill = await transaction.skill.upsert({
              where: { normalizedName: normalized.normalizedName },
              create: {
                name: normalized.displayName,
                normalizedName: normalized.normalizedName,
              },
              update: {},
              select: { id: true },
            });
            await transaction.candidateProfileSkill.create({
              data: {
                profileId: lock.profileId,
                skillId: skill.id,
                displayName: normalized.displayName,
                position: skillPosition,
              },
            });
            skillPosition += 1;
            skillNames.add(normalized.normalizedName);
            counts.skills += 1;
          }
          this.failurePoint("after-skills");

          const existingLinks = await transaction.socialLink.findMany({
            where: { profileId: lock.profileId },
            orderBy: { position: "asc" },
          });
          let linkCount = existingLinks.reduce(
            (next, link) => Math.max(next, link.position + 1),
            0,
          );
          const existingLinkByUrl = new Map<string, string>();
          const existingLinkById = new Map(
            existingLinks.map((link) => [link.id, link]),
          );
          for (const link of existingLinks) {
            try {
              existingLinkByUrl.set(normalizeSocialUrl(link.url), link.id);
            } catch {
              // Keep legacy invalid data untouched; submitted values are
              // still validated before they are written.
            }
          }
          for (const proposal of proposals.socialLinks) {
            const decision = linkDecisions.get(proposal.proposalId);
            if (!decision || decision.action === "SKIP") continue;
            let value: string;
            try {
              value = normalizeSocialUrl(proposal.value);
            } catch (error) {
              throw reviewValidationError(
                `proposals.socialLinks.${proposals.socialLinks.indexOf(proposal)}.value`,
                error,
              );
            }
            if (decision.action === "REPLACE" && !decision.targetId)
              throw new CvImportServiceError("VALIDATION_ERROR");
            if (decision.action === "REPLACE" && decision.targetId) {
              const target = existingLinkById.get(decision.targetId);
              const duplicateId = existingLinkByUrl.get(value);
              if (duplicateId && duplicateId !== decision.targetId)
                throw new CvImportServiceError("VALIDATION_ERROR");
              const changed = await transaction.socialLink.updateMany({
                where: { id: decision.targetId, profileId: lock.profileId },
                data: { url: value, normalizedUrl: value },
              });
              if (changed.count !== 1)
                throw new CvImportServiceError("PROFILE_REVISION_CONFLICT", {
                  latest,
                });
              if (target) {
                try {
                  const previousValue = normalizeSocialUrl(target.url);
                  if (existingLinkByUrl.get(previousValue) === target.id)
                    existingLinkByUrl.delete(previousValue);
                } catch {
                  // The replacement value has already passed validation.
                }
              }
              existingLinkByUrl.set(value, decision.targetId);
            } else {
              // ADD is idempotent when the link is already in the Profile.
              if (existingLinkByUrl.has(value)) continue;
              if (linkCount >= 10)
                throw new CvImportServiceError("VALIDATION_ERROR");
              const socialLinkId = randomUUID();
              await transaction.socialLink.create({
                data: {
                  id: socialLinkId,
                  profileId: lock.profileId,
                  url: value,
                  normalizedUrl: value,
                  position: linkCount,
                },
              });
              linkCount += 1;
              existingLinkByUrl.set(value, socialLinkId);
            }
            counts.socialLinks += 1;
          }
          this.failurePoint("after-social-links");

          const profile = await transaction.candidateProfile.update({
            where: { id: lock.profileId },
            data: { revision: { increment: 1 } },
            select: { revision: true },
          });
          if (profile.revision !== lock.profileRevision + 1)
            throw new CvImportServiceError("PROFILE_REVISION_CONFLICT", {
              latest,
            });
          this.failurePoint("after-profile-revision");
          const selectionManifest = {
            version: "cv-selection-v1",
            decisions,
            counts,
          };
          // node:crypto returns Buffer, but Prisma 7's driver-adapter bytes
          // encoder requires a plain Uint8Array rather than a Buffer subclass.
          const selectionManifestDigest = Uint8Array.from(
            createHash("sha256")
              .update(canonicalJson(selectionManifest), "utf8")
              .digest(),
          );
          const confirmationId = randomUUID();
          const purgeAt = new Date(input.now.getTime() + 7 * 86_400_000);
          const deleteAfter =
            purgeAt < lock.uploadExpiresAt ? purgeAt : lock.uploadExpiresAt;
          const confirmation = await transaction.cvImportConfirmation.create({
            data: {
              id: confirmationId,
              accountId: input.accountId,
              profileId: lock.profileId,
              uploadId: lock.uploadId,
              draftId: lock.draftId,
              idempotencyDigest: digest,
              selectionManifestVersion: "cv-selection-v1",
              selectionManifestDigest,
              selectionManifest,
              draftRevision: input.draftRevision,
              sourceProfileRevision: input.sourceProfileRevision,
              reviewedProfileRevision: input.reviewedProfileRevision,
              profileRevisionBefore: lock.profileRevision,
              profileRevisionAfter: profile.revision,
              appliedScalarCount: counts.scalars,
              appliedExperienceCount: counts.experiences,
              appliedEducationCount: counts.education,
              appliedSkillCount: counts.skills,
              appliedSocialLinkCount: counts.socialLinks,
              confirmedAt: input.now,
            },
            select: confirmationProjection,
          });
          this.failurePoint("after-receipt");
          await transaction.cvDraft.update({
            where: { id: lock.draftId },
            data: {
              status: "CONFIRMED",
              confirmedAt: input.now,
              contentInaccessibleAt: input.now,
              payloadDeleteAfter: deleteAfter,
            },
          });
          this.failurePoint("after-draft-freeze");
          await transaction.cvUpload.update({
            where: { id: lock.uploadId },
            data: {
              status: "CONFIRMED",
              confirmedAt: input.now,
              contentInaccessibleAt: input.now,
              deleteAfter,
            },
            select: { id: true },
          });
          this.failurePoint("after-upload-freeze");
          await transaction.cvStoredArtifact.updateMany({
            where: { uploadId: lock.uploadId, deletedAt: null },
            data: { contentInaccessibleAt: input.now, deleteAfter },
          });
          this.failurePoint("after-artifact-freeze");
          await transaction.auditEvent.create({
            data: {
              occurredAt: input.now,
              actorType: "user",
              actorUserId: input.accountId,
              action: "cv_import.confirmed",
              targetType: "cv_confirmation",
              targetId: confirmationId,
              result: "SUCCESS",
              correlationId: randomUUID(),
              context: { revision: profile.revision },
            },
          });
          this.failurePoint("after-audit");
          this.failurePoint("before-commit");
          return { receipt: receipt(confirmation), replayed: false } as const;
        },
        { isolationLevel: "Serializable" },
      );
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        const replay = await prisma.cvImportConfirmation.findFirst({
          where: { accountId: input.accountId, idempotencyDigest: digest },
          select: confirmationProjection,
        });
        if (replay) {
          const digestRows = await prisma.$queryRaw<
            Array<{ digestHex: string }>
          >`
            SELECT encode("selectionManifestDigest", 'hex') AS "digestHex"
              FROM "CvImportConfirmation" WHERE "id" = ${replay.id}
          `;
          const storedDigest = digestRows[0]?.digestHex;
          if (!storedDigest)
            throw new CvImportServiceError("IDEMPOTENCY_KEY_REUSED");
          assertConfirmationBinding(
            {
              ...replay,
              selectionManifestDigest: Uint8Array.from(
                Buffer.from(storedDigest, "hex"),
              ),
            },
            input,
          );
          return { receipt: receipt(replay), replayed: true } as const;
        }
        if (error instanceof CvImportServiceError) throw error;
        if (attempt < 2 && isRetryableTransactionConflict(error)) continue;
        throw error;
      }
    }
    throw new Error("CV_CONFIRMATION_RETRY_EXHAUSTED");
  }
}
