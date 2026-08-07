import "server-only";

import { randomUUID } from "node:crypto";

import type { StoredCvSegment } from "@/backend/cv/extraction/extracted-segment-store";
import { prisma } from "@/backend/database/prisma";
import type { Prisma } from "@/backend/generated/prisma/client";
import {
  assertCvStageResultCommitAllowed,
  type CvStageResultCommitGuard,
} from "@/backend/repositories/cv-import/prisma-cv-work-repository";
import { PlainTextNormalizer } from "@/backend/security/plain-text/plain-text-normalizer";
import {
  assertIsoDate,
  normalizeSkillName,
  normalizeSocialUrl,
  validateProfilePhone,
} from "@/backend/services/profile/profile-validation";
import { canonicalJsonBytes } from "@/shared/contracts/cv-import/common";
import {
  assertParserOutputWithinLimits,
  cvParserAnyOutputSchema,
  validateParserEvidenceMembership,
  type CvParserAnyOutput,
  type CvParserOutputV2,
} from "@/shared/contracts/cv-import/parser-output";

export class CvDraftCreationError extends Error {
  readonly name = "CvDraftCreationError";

  constructor(
    readonly code: "PARSER_OUTPUT_INVALID" | "PARSER_OUTPUT_LIMIT_EXCEEDED",
  ) {
    super(code);
  }

  toJSON() {
    return { name: this.name, code: this.code };
  }
}

type DraftWrite = Readonly<{
  id: string;
  accountId: string;
  uploadId: string;
  parseJobId: string;
  profileId: string;
  schemaVersion: "cv-draft-v1" | "cv-draft-v2";
  revision: 0;
  sourceProfileRevision: number;
  reviewedProfileRevision: number;
  proposalPayload: Prisma.InputJsonValue;
  provenancePayload: Prisma.InputJsonValue;
  payloadBytes: number;
  provenanceBytes: number;
  expiresAt: Date;
  proposals: readonly Readonly<{ id: string }>[];
}>;

type DraftCommitGuard = Readonly<
  Omit<CvStageResultCommitGuard, "now"> & { currentTime(): Date }
>;

type DraftDispatchEvidence = Readonly<{
  providerRequestIdHmac: Uint8Array;
}>;

type Dependencies = Readonly<{
  saveDraft(
    draft: DraftWrite,
    guard?: DraftCommitGuard,
    dispatchEvidence?: DraftDispatchEvidence,
  ): Promise<unknown>;
  newId(): string;
}>;

const normalizer = new PlainTextNormalizer();

function text(
  value: string,
  field: string,
  maximum: number,
  multiline = false,
) {
  const normalized = normalizer.normalize(value, {
    field,
    maxCodePoints: maximum,
    required: true,
    multiline,
  }).value;
  if (!normalized) throw new CvDraftCreationError("PARSER_OUTPUT_INVALID");
  return normalized;
}

function evidence(
  proposal: {
    confidence: number | null;
    sourceSegmentIds: string[];
  },
  segmentEvidence?: ReadonlyMap<
    string,
    CvParserOutputV2["segmentEvidence"][number]
  >,
) {
  const sources = proposal.sourceSegmentIds.flatMap((id) => {
    const value = segmentEvidence?.get(id);
    return value ? [value] : [];
  });
  const base = {
    confidence: proposal.confidence,
    locations: proposal.sourceSegmentIds,
    contextAvailable: false,
    context: null,
  };
  if (!segmentEvidence) return base;
  const warnings = [...new Set(sources.flatMap((source) => source.warnings))];
  return {
    ...base,
    sourceMethods: [...new Set(sources.map((source) => source.sourceMethod))],
    sourceLocations: [
      ...new Set(sources.map((source) => source.sourceLocation)),
    ],
    warnings,
    reviewRequired:
      warnings.length > 0 ||
      sources.some((source) =>
        ["REVIEW", "LOW"].includes(source.confidenceLevel),
      ),
  };
}

function validateDates(output: CvParserAnyOutput) {
  for (const [group, values] of [
    ["experiences", output.experiences],
    ["education", output.education],
  ] as const) {
    values.forEach((value, index) => {
      assertIsoDate(`${group}.${index}.startDate`, value.startDate);
      if (value.endDate)
        assertIsoDate(`${group}.${index}.endDate`, value.endDate);
      if (
        (value.isCurrent && value.endDate) ||
        (!value.isCurrent && !value.endDate)
      )
        throw new CvDraftCreationError("PARSER_OUTPUT_INVALID");
      if (value.endDate && value.endDate < value.startDate)
        throw new CvDraftCreationError("PARSER_OUTPUT_INVALID");
    });
  }
}

function buildPayload(output: CvParserAnyOutput, newId: () => string) {
  const segmentEvidence =
    output.schemaVersion === "cv-draft-v2"
      ? new Map(output.segmentEvidence.map((value) => [value.segmentId, value]))
      : undefined;
  const provenance: Record<string, ReturnType<typeof evidence>> = {};
  const all: Array<Readonly<{ id: string }>> = [];
  const assign = <
    T extends { confidence: number | null; sourceSegmentIds: string[] },
  >(
    value: T,
  ) => {
    const proposalId = `proposal_${newId().replaceAll("-", "")}`;
    const item = { id: proposalId };
    all.push(item);
    provenance[proposalId] = evidence(value, segmentEvidence);
    return proposalId;
  };
  const scalars = Object.entries(output.scalars).flatMap(
    ([field, proposal]) => {
      if (!proposal) return [];
      const maximum =
        field === "summary"
          ? 5_000
          : field === "phone"
            ? 32
            : field === "location"
              ? 160
              : 200;
      const normalized =
        field === "phone"
          ? validateProfilePhone(proposal.value)
          : text(
              proposal.value,
              `scalars.${field}`,
              maximum,
              field === "summary",
            );
      if (!normalized) throw new CvDraftCreationError("PARSER_OUTPUT_INVALID");
      const proposalId = assign(proposal);
      return [{ proposalId, field, value: normalized }];
    },
  );
  const experiences = output.experiences.map((proposal, index) => {
    const proposalId = assign(proposal);
    return {
      proposalId,
      value: {
        title: text(proposal.title, `experiences.${index}.title`, 200),
        company: text(proposal.company, `experiences.${index}.company`, 200),
        description: proposal.description
          ? text(
              proposal.description,
              `experiences.${index}.description`,
              3_000,
              true,
            )
          : null,
        startDate: proposal.startDate,
        endDate: proposal.endDate,
        isCurrent: proposal.isCurrent,
      },
      duplicateTargetIds: [],
    };
  });
  const education = output.education.map((proposal, index) => {
    const proposalId = assign(proposal);
    return {
      proposalId,
      value: {
        institution: text(
          proposal.institution,
          `education.${index}.institution`,
          200,
        ),
        degree: text(proposal.degree, `education.${index}.degree`, 200),
        field: proposal.field
          ? text(proposal.field, `education.${index}.field`, 200)
          : null,
        startDate: proposal.startDate,
        endDate: proposal.endDate,
        isCurrent: proposal.isCurrent,
      },
      duplicateTargetIds: [],
    };
  });
  const seenSkills = new Set<string>();
  const skills = output.skills.map((proposal) => {
    const normalized = normalizeSkillName(proposal.name);
    if (seenSkills.has(normalized.normalizedName))
      throw new CvDraftCreationError("PARSER_OUTPUT_INVALID");
    seenSkills.add(normalized.normalizedName);
    const proposalId = assign(proposal);
    return {
      proposalId,
      value: normalized.displayName,
      duplicate: false,
    };
  });
  const seenLinks = new Set<string>();
  const socialLinks = output.socialLinks.map((proposal) => {
    const value = normalizeSocialUrl(proposal.url);
    if (seenLinks.has(value))
      throw new CvDraftCreationError("PARSER_OUTPUT_INVALID");
    seenLinks.add(value);
    const proposalId = assign(proposal);
    return { proposalId, value, duplicateTargetIds: [] };
  });
  return {
    proposalPayload: { scalars, experiences, education, skills, socialLinks },
    provenancePayload: provenance,
    proposals: all,
  };
}

function defaults(): Dependencies {
  return {
    newId: randomUUID,
    async saveDraft(draft, guard, dispatchEvidence) {
      await prisma.$transaction(async (transaction) => {
        const current = guard?.currentTime();
        if (guard) {
          if (!current || Number.isNaN(current.getTime())) {
            throw new Error("CV_WORKER_CLOCK_INVALID");
          }
          await assertCvStageResultCommitAllowed(transaction, {
            ...guard,
            now: current,
          });
        }
        if (dispatchEvidence) {
          if (dispatchEvidence.providerRequestIdHmac.byteLength !== 32) {
            throw new Error("CV_PROVIDER_EVIDENCE_INVALID");
          }
          const providerRequestIdHmac = new Uint8Array(
            dispatchEvidence.providerRequestIdHmac.byteLength,
          );
          providerRequestIdHmac.set(dispatchEvidence.providerRequestIdHmac);
          await transaction.cvParseJob.update({
            where: { id: draft.parseJobId },
            data: {
              providerRequestIdHmac,
            },
            select: { id: true },
          });
          await transaction.auditEvent.createMany({
            data: [
              {
                id: `cve_${draft.parseJobId}`.slice(0, 80),
                occurredAt: current ?? new Date(),
                actorType: "system",
                action: "cv_import.external_dispatch_completed",
                targetType: "cv_import",
                targetId: draft.uploadId,
                result: "SUCCESS",
                correlationId: `cv_external_${draft.parseJobId}`.slice(0, 128),
                context: {
                  stage: "PARSE",
                  state: "DISPATCH_COMPLETED",
                  parserClass: "EXTERNAL_OPENAI",
                  schemaVersion: draft.schemaVersion,
                },
              },
            ],
            skipDuplicates: true,
          });
        }
        await transaction.cvDraft.create({
          data: {
            id: draft.id,
            accountId: draft.accountId,
            uploadId: draft.uploadId,
            parseJobId: draft.parseJobId,
            profileId: draft.profileId,
            schemaVersion: draft.schemaVersion,
            revision: draft.revision,
            sourceProfileRevision: draft.sourceProfileRevision,
            reviewedProfileRevision: draft.reviewedProfileRevision,
            proposalPayload: draft.proposalPayload,
            provenancePayload: draft.provenancePayload,
            payloadBytes: draft.payloadBytes,
            provenanceBytes: draft.provenanceBytes,
            expiresAt: draft.expiresAt,
          },
        });
        if (guard) {
          const changed = await transaction.cvUpload.updateMany({
            where: {
              id: draft.uploadId,
              accountId: draft.accountId,
              status: { in: ["PARSE_QUEUED", "PARSING"] },
              expiresAt: { gt: current },
              contentInaccessibleAt: null,
              deletedAt: null,
            },
            data: { status: "REVIEW_READY", failureCode: null },
          });
          if (changed.count !== 1) {
            throw new Error("CV_STAGE_RESULT_DISCARDED");
          }
        }
      });
      return draft;
    },
  };
}

export class CreateCvDraftService {
  private readonly dependencies: Dependencies;

  constructor(
    dependencies?: Pick<Dependencies, "saveDraft"> &
      Partial<Pick<Dependencies, "newId">>,
  ) {
    const base = defaults();
    this.dependencies = dependencies
      ? { ...dependencies, newId: dependencies.newId ?? base.newId }
      : base;
  }

  async execute(input: {
    accountId: string;
    uploadId: string;
    parseJobId: string;
    profileId: string;
    sourceProfileRevision: number;
    output: unknown;
    segments: readonly StoredCvSegment[];
    expiresAt: Date;
    commitGuard?: DraftCommitGuard;
    dispatchEvidence?: DraftDispatchEvidence;
  }): Promise<DraftWrite> {
    try {
      const output = cvParserAnyOutputSchema.parse(input.output);
      const available = new Set(input.segments.map((segment) => segment.id));
      if (!validateParserEvidenceMembership(output, available))
        throw new CvDraftCreationError("PARSER_OUTPUT_INVALID");
      validateDates(output);
      const built = buildPayload(output, this.dependencies.newId);
      assertParserOutputWithinLimits(output, built.provenancePayload);
      const payloadBytes = canonicalJsonBytes(built.proposalPayload);
      const provenanceBytes = canonicalJsonBytes(built.provenancePayload);
      const draft = Object.freeze({
        id: this.dependencies.newId(),
        accountId: input.accountId,
        uploadId: input.uploadId,
        parseJobId: input.parseJobId,
        profileId: input.profileId,
        schemaVersion: output.schemaVersion,
        revision: 0 as const,
        sourceProfileRevision: input.sourceProfileRevision,
        reviewedProfileRevision: input.sourceProfileRevision,
        proposalPayload: built.proposalPayload,
        provenancePayload: built.provenancePayload,
        payloadBytes,
        provenanceBytes,
        expiresAt: input.expiresAt,
        proposals: Object.freeze(built.proposals),
      });
      if (payloadBytes > 256 * 1024 || provenanceBytes > 128 * 1024)
        throw new CvDraftCreationError("PARSER_OUTPUT_LIMIT_EXCEEDED");
      await this.dependencies.saveDraft(
        draft,
        input.commitGuard,
        input.dispatchEvidence,
      );
      return draft;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "CV_STAGE_RESULT_DISCARDED"
      ) {
        throw error;
      }
      if (error instanceof CvDraftCreationError) throw error;
      if (error instanceof RangeError)
        throw new CvDraftCreationError("PARSER_OUTPUT_LIMIT_EXCEEDED");
      throw new CvDraftCreationError("PARSER_OUTPUT_INVALID");
    }
  }
}
