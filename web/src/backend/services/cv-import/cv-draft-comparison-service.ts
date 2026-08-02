import "server-only";

import { PrismaCvDraftCommandRepository } from "@/backend/repositories/cv-import/prisma-cv-draft-command-repository";
import { PrismaCvDraftQueryRepository } from "@/backend/repositories/cv-import/prisma-cv-draft-query-repository";
import {
  PlainTextNormalizationError,
  PlainTextNormalizer,
} from "@/backend/security/plain-text/plain-text-normalizer";
import {
  normalizeSkillName,
  normalizeSocialUrl,
  ProfileValidationError,
  validateEducationEntry,
  validateExperienceEntry,
  validateProfilePhone,
} from "@/backend/services/profile/profile-validation";
import {
  assertCompleteReview,
  saveCvDraftRequestSchema,
  type CvDraftComparison,
  type CvEditableProposals,
  type SaveCvDraftRequest,
} from "@/shared/contracts/cv-import/review";
import { CvImportServiceError } from "./cv-http-errors";

const normalizer = new PlainTextNormalizer();

function normalizedText(
  value: string,
  field: string,
  maximum: number,
  multiline = false,
) {
  const result = normalizer.normalize(value, {
    field,
    maxCodePoints: maximum,
    required: true,
    multiline,
  }).value;
  if (!result) throw new CvImportServiceError("VALIDATION_ERROR");
  return result;
}

function key(...values: string[]) {
  return values
    .map((value) => value.normalize("NFKC").trim().toLocaleLowerCase("en-US"))
    .join("\0");
}

function authoritativeMap(
  comparison: CvDraftComparison,
  group: keyof CvEditableProposals,
) {
  return new Map(
    comparison.proposals[group].map((proposal) => [
      proposal.proposalId,
      proposal,
    ]),
  );
}

function normalizeProposals(
  requested: CvEditableProposals,
  comparison: CvDraftComparison,
  today: string,
): CvEditableProposals {
  const scalarAuthority = authoritativeMap(comparison, "scalars");
  const experienceAuthority = authoritativeMap(comparison, "experiences");
  const educationAuthority = authoritativeMap(comparison, "education");
  const skillAuthority = authoritativeMap(comparison, "skills");
  const linkAuthority = authoritativeMap(comparison, "socialLinks");
  const scalars = requested.scalars.map((proposal) => {
    const source = scalarAuthority.get(proposal.proposalId);
    if (!source || !("field" in source) || source.field !== proposal.field)
      throw new CvImportServiceError("VALIDATION_ERROR");
    const maximum =
      proposal.field === "summary"
        ? 5_000
        : proposal.field === "phone"
          ? 32
          : proposal.field === "location"
            ? 160
            : 200;
    const value =
      proposal.field === "phone"
        ? validateProfilePhone(proposal.value)
        : normalizedText(
            proposal.value,
            `scalars.${proposal.field}`,
            maximum,
            proposal.field === "summary",
          );
    if (!value) throw new CvImportServiceError("VALIDATION_ERROR");
    return { ...proposal, value, evidence: source.evidence };
  });
  const experiences = requested.experiences.map((proposal, index) => {
    const source = experienceAuthority.get(proposal.proposalId);
    if (!source || !("evidence" in source))
      throw new CvImportServiceError("VALIDATION_ERROR");
    const value = {
      title: normalizedText(
        proposal.value.title,
        `experiences.${index}.title`,
        200,
      ),
      company: normalizedText(
        proposal.value.company,
        `experiences.${index}.company`,
        200,
      ),
      description: proposal.value.description
        ? normalizedText(
            proposal.value.description,
            `experiences.${index}.description`,
            3_000,
            true,
          )
        : null,
      startDate: proposal.value.startDate,
      endDate: proposal.value.endDate,
      isCurrent: proposal.value.isCurrent,
    };
    validateExperienceEntry(
      {
        title: value.title,
        company: value.company,
        description: value.description,
        startDate: value.startDate,
        endDate: value.endDate,
        current: value.isCurrent,
      },
      today,
      index,
    );
    const duplicateTargetIds = comparison.currentProfile.experiences
      .filter(
        (entry) =>
          key(entry.title, entry.company) === key(value.title, value.company),
      )
      .map(({ id }) => id)
      .slice(0, 10);
    return {
      ...proposal,
      value,
      duplicateTargetIds,
      evidence: source.evidence,
    };
  });
  const education = requested.education.map((proposal, index) => {
    const source = educationAuthority.get(proposal.proposalId);
    if (!source || !("evidence" in source))
      throw new CvImportServiceError("VALIDATION_ERROR");
    const value = {
      institution: normalizedText(
        proposal.value.institution,
        `education.${index}.institution`,
        200,
      ),
      degree: normalizedText(
        proposal.value.degree,
        `education.${index}.degree`,
        200,
      ),
      field: proposal.value.field
        ? normalizedText(proposal.value.field, `education.${index}.field`, 200)
        : null,
      startDate: proposal.value.startDate,
      endDate: proposal.value.endDate,
      isCurrent: proposal.value.isCurrent,
    };
    validateEducationEntry(
      {
        institution: value.institution,
        degree: value.degree,
        field: value.field,
        startDate: value.startDate,
        endDate: value.endDate,
        current: value.isCurrent,
      },
      today,
      index,
    );
    const duplicateTargetIds = comparison.currentProfile.education
      .filter(
        (entry) =>
          key(entry.institution, entry.degree) ===
          key(value.institution, value.degree),
      )
      .map(({ id }) => id)
      .slice(0, 10);
    return {
      ...proposal,
      value,
      duplicateTargetIds,
      evidence: source.evidence,
    };
  });
  const skillKeys = new Set<string>();
  const skills = requested.skills.map((proposal) => {
    const source = skillAuthority.get(proposal.proposalId);
    if (!source || !("evidence" in source))
      throw new CvImportServiceError("VALIDATION_ERROR");
    const normalized = normalizeSkillName(proposal.value);
    if (skillKeys.has(normalized.normalizedName))
      throw new CvImportServiceError("VALIDATION_ERROR");
    skillKeys.add(normalized.normalizedName);
    return {
      ...proposal,
      value: normalized.displayName,
      duplicate: comparison.currentProfile.skills.some(
        (entry) =>
          normalizeSkillName(entry.displayName).normalizedName ===
          normalized.normalizedName,
      ),
      evidence: source.evidence,
    };
  });
  const linkKeys = new Set<string>();
  const socialLinks = requested.socialLinks.map((proposal) => {
    const source = linkAuthority.get(proposal.proposalId);
    if (!source || !("evidence" in source))
      throw new CvImportServiceError("VALIDATION_ERROR");
    const value = normalizeSocialUrl(proposal.value);
    if (linkKeys.has(value)) throw new CvImportServiceError("VALIDATION_ERROR");
    linkKeys.add(value);
    return {
      ...proposal,
      value,
      duplicateTargetIds: comparison.currentProfile.socialLinks
        .filter((entry) => normalizeSocialUrl(entry.url) === value)
        .map(({ id }) => id)
        .slice(0, 10),
      evidence: source.evidence,
    };
  });
  return { scalars, experiences, education, skills, socialLinks };
}

export class CvDraftComparisonService {
  constructor(
    private readonly query = new PrismaCvDraftQueryRepository(),
    private readonly commands = new PrismaCvDraftCommandRepository(),
  ) {}

  async get(accountId: string, draftId: string) {
    const comparison = await this.query.getOwnedComparison(accountId, draftId);
    if (!comparison) throw new CvImportServiceError("CV_DRAFT_NOT_FOUND");
    return comparison;
  }

  async save(accountId: string, draftId: string, raw: SaveCvDraftRequest) {
    const parsed = saveCvDraftRequestSchema.safeParse(raw);
    if (!parsed.success) throw new CvImportServiceError("VALIDATION_ERROR");
    const request = parsed.data;
    const comparison = await this.get(accountId, draftId);
    const now = new Date();
    let proposals: CvEditableProposals;
    try {
      proposals = normalizeProposals(
        request.proposals,
        comparison,
        now.toISOString().slice(0, 10),
      );
      assertCompleteReview({
        proposals,
        decisions: request.reviewDecisions,
      });
    } catch (error) {
      if (error instanceof CvImportServiceError) throw error;
      if (
        error instanceof ProfileValidationError ||
        error instanceof PlainTextNormalizationError
      )
        throw new CvImportServiceError("VALIDATION_ERROR", {
          fieldErrors: [
            {
              path: error.field.replace(/^experience\./u, "experiences."),
              code: error.code,
              message: "This value is invalid.",
            },
          ],
        });
      if (
        error instanceof Error &&
        error.message === "CV_REVIEW_DECISIONS_INCOMPLETE"
      )
        throw new CvImportServiceError("VALIDATION_ERROR");
      throw error;
    }
    return this.commands.save({
      accountId,
      draftId,
      baseDraftRevision: request.baseDraftRevision,
      reviewedProfileRevision: request.reviewedProfileRevision,
      proposals,
      reviewDecisions: request.reviewDecisions,
      now,
    });
  }
}
