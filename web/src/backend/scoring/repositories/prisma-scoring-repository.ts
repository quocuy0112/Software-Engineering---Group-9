import "server-only";

import { prisma } from "@/backend/database/prisma";
import type {
  AiAssessment,
  AutomaticMatch,
  FinalScore,
  ManualPriority,
  ScoringOperation,
} from "@/shared/contracts/scoring";
import type { ScoringRepositoryPort, PublishedScoringRecord } from "./scoring-repository";
import { SKILL_NORMALIZATION_VERSION } from "../domain/skill-evidence-extractor";

/* The generated Prisma include projection is intentionally narrowed at the
 * contract boundary below; the projection contains encrypted text fields. */
/* eslint-disable @typescript-eslint/no-explicit-any */

const parseStatus = (value: string | undefined, snapshotVersion: string, parserVersion: string) => ({
  code: value === "FAILED" || value === "PARSED_WITH_ERRORS" ? value : "PARSED_SUCCESSFULLY",
  label: value === "FAILED" ? "Failed" : value === "PARSED_WITH_ERRORS" ? "Parsed with errors" : "Parsed successfully",
  parserVersion,
  processingMilliseconds: 0,
  snapshotVersion,
} as const);

function priorityLabel(value: ManualPriority["value"]) {
  return value === "HIGH" ? "High review priority" : value === "LOW" ? "Low review priority" : value === "HOLD" ? "Hold" : "Normal";
}

function humanAiFindingTitle(value: string): string {
  const normalized = value.trim();
  return {
    required_skills_match: "Required skills match",
    experience_match: "Experience match",
    preferred_skills_match: "Preferred skills match",
    education_certifications: "Education and certifications",
    languages: "Language proficiency",
    "Skill found verbatim": "Skill found",
    input_limitation: "Input limitation",
    extraction_uncertainty: "Extraction uncertainty",
    data_quality_notes: "Data quality review",
    "Data quality review": "Data quality review",
    "Extraction flag": "Extraction flag",
  }[normalized] ?? normalized;
}

function aiQualityCategory(title: string, evidence: string): string {
  const value = `${title} ${evidence}`.toLocaleLowerCase("en-US");
  if (/date|employment|startdate|enddate|duration|redact/iu.test(value)) return "employment_dates";
  if (/duplicate|repeated|appears more than once/iu.test(value)) return "duplicate_records";
  if (/bullet|responsibilit|no .*provided/iu.test(value)) return "missing_responsibilities";
  if (/cover letter/iu.test(value)) return "missing_cover_letter";
  if (/anomal|unrelated|merge|cross.?candidate|stale/iu.test(value)) return "anomalous_profile_data";
  return value.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function normalizedEvidenceText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}+#.]+/gu, " ")
    .trim();
}

function deterministicStrengthFallback(
  automatic: AutomaticMatch,
  findings: AiAssessment["findings"],
): AiAssessment["findings"] {
  return automatic.foundRequiredSkills
    .filter((skill) => {
      const label = normalizedEvidenceText(skill.label);
      return !findings.some((finding) => finding.kind === "STRENGTH" && normalizedEvidenceText(`${finding.title} ${finding.evidence}`).includes(label));
    })
    .map((skill) => ({
      id: `deterministic-skill-${skill.skillCode}`,
      kind: "STRENGTH" as const,
      title: "Skill found",
      evidence: skill.evidence[0]?.excerpt
        ?? `Matched by deterministic CV evidence: ${skill.label}. Verbatim excerpt is unavailable for this scoring run.`,
    }));
}

function operationProjection(row: {
  id: string;
  kind: "INITIAL" | "JOB_RESCORE" | "AI_RETRY";
  state: "QUEUED" | "RUNNING" | "COMPLETED" | "COMPLETED_WITH_FAILURES" | "FAILED";
  totalCount: number;
  succeededCount: number;
  deterministicOnlyCount: number;
  failedCount: number;
  requestedAt: Date;
  completedAt: Date | null;
}): ScoringOperation {
  return {
    operationId: row.id,
    kind: row.kind,
    state: row.state,
    totalCount: row.totalCount,
    succeededCount: row.succeededCount,
    deterministicOnlyCount: row.deterministicOnlyCount,
    failedCount: row.failedCount,
    requestedAt: row.requestedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

export class PrismaScoringRepository implements ScoringRepositoryPort {
  constructor(private readonly db: typeof prisma = prisma) {}

  async createOperation(input: Parameters<ScoringRepositoryPort["createOperation"]>[0]) {
    const row = await this.db.scoringOperation.upsert({
      where: {
        requestedByUserId_idempotencyKey: {
          requestedByUserId: input.requestedByUserId,
          idempotencyKey: input.idempotencyKey,
        },
      },
      update: {},
      create: {
        kind: input.kind,
        jobPostingId: input.jobPostingId,
        jobApplicationId: input.jobApplicationId,
        requestedByUserId: input.requestedByUserId,
        requestedAt: input.requestedAt,
        confirmationIntent: input.confirmationIntent,
        idempotencyKey: input.idempotencyKey,
        targetJobDescriptionVersionId: input.targetJobDescriptionVersionId,
        targetScoringConfigVersionId: input.targetScoringConfigVersionId,
        reusedAutomaticMatchResultId: input.reusedAutomaticMatchResultId,
      },
      select: {
        id: true,
        kind: true,
        state: true,
        totalCount: true,
        succeededCount: true,
        deterministicOnlyCount: true,
        failedCount: true,
        requestedAt: true,
        completedAt: true,
      },
    });
    return operationProjection(row);
  }

  async findOperation(operationId: string) {
    const row = await this.db.scoringOperation.findUnique({
      where: { id: operationId },
      select: {
        id: true,
        kind: true,
        state: true,
        totalCount: true,
        succeededCount: true,
        deterministicOnlyCount: true,
        failedCount: true,
        requestedAt: true,
        completedAt: true,
      },
    });
    return row ? operationProjection(row) : null;
  }

  async findCurrent(applicationId: string): Promise<PublishedScoringRecord | null> {
    const row = await this.db.applicationScoringResult.findFirst({
      where: { jobApplicationId: applicationId, application: { currentScoringResultId: { not: null } } },
      orderBy: { generation: "desc" },
      include: {
        automaticMatch: { include: { parseResults: true, skillEvidence: { include: { excerpts: true } } } },
        aiAssessment: { include: { findings: true, questions: true } },
        operation: { select: { id: true, state: true } },
      },
    });
    if (!row) return null;
    const automatic = this.projectAutomatic(row.automaticMatch);
    const ai = row.aiAssessment ? this.projectAi(row.aiAssessment, automatic) : null;
    const finalScore = row.finalScore === null || !ai
      ? null
      : {
          value: Number(row.finalScore),
          formulaText: `${Number(row.automaticScore)} × 0.6 + ${Number(row.aiScore)} × 0.4 = ${Number(row.finalScore)}`,
          formulaVersion: row.formulaVersion,
          automaticWeight: 0.6 as const,
          aiWeight: 0.4 as const,
          band: Number(row.finalScore) >= 80 ? { code: "HIGH_MATCH", label: "Strong match", iconLabel: "✓" } : Number(row.finalScore) >= 60 ? { code: "MEDIUM_MATCH", label: "Review needed", iconLabel: "!" } : { code: "LOW_MATCH", label: "Low match", iconLabel: "✕" },
          cvVersion: row.cvSnapshotVersionId,
          jdVersion: row.jobDescriptionVersionId,
          configVersion: row.scoringConfigVersionId,
          computedAt: row.computedAt.toISOString(),
        } satisfies FinalScore;
    const explicitFinalScore = finalScore ? {
      ...finalScore,
      formulaText: `${Number(row.automaticScore)} ${String.fromCharCode(215)} 0.6 + ${Number(row.aiScore)} ${String.fromCharCode(215)} 0.4 = ${Number(row.finalScore)}`,
      band: { ...finalScore.band, iconLabel: finalScore.band.code === "HIGH_MATCH" ? String.fromCharCode(10003) : finalScore.band.code === "LOW_MATCH" ? String.fromCharCode(10005) : "!" },
    } satisfies FinalScore : null;
    return {
      resultId: row.id,
      generation: row.generation,
      state: row.state,
      automatic,
      ai,
      finalScore: explicitFinalScore,
      operationId: row.operationId,
      consecutiveFailures: 1,
      rescoreInProgress: row.operation.state === "QUEUED" || row.operation.state === "RUNNING",
    };
  }

  private projectAutomatic(row: any): AutomaticMatch {
    const cvParse = row.parseResults.find((item: any) => item.documentKind === "CV");
    const jdParse = row.parseResults.find((item: any) => item.documentKind === "JOB_DESCRIPTION");
    const skills = row.skillEvidence.map((item: any) => ({
      skillCode: item.skillCanonicalId,
      label: item.skillLabel,
      requirementKind: item.requirementKind,
      matchState: item.matchState,
      evidence: item.excerpts.map((excerpt: any) => ({
        excerpt: excerpt.excerptEncrypted,
        ...(excerpt.pageNumber ? { pageNumber: excerpt.pageNumber } : { sectionLabel: excerpt.sectionLabel ?? "CV body" }),
        cvSnapshotVersion: excerpt.cvSnapshotVersionId,
        parserVersion: excerpt.parserVersion,
      })),
    }));
    return {
      resultId: row.id,
      score: Number(row.score),
      cvVersion: row.cvSnapshotVersionId,
      jdVersion: row.jobDescriptionVersionId,
      configVersion: row.scoringConfigVersionId,
      parserVersion: row.parserBundleVersion,
      cvParse: parseStatus(cvParse?.status, row.cvSnapshotVersionId, row.parserBundleVersion),
      jdParse: parseStatus(jdParse?.status, row.jobDescriptionVersionId, row.parserBundleVersion),
      mayBeIncomplete: row.mayBeIncomplete,
      incompletenessLabel: row.incompletenessLabel,
      foundRequiredSkills: skills.filter((item: any) => item.matchState === "FOUND" && item.requirementKind === "REQUIRED"),
      missingRequiredSkills: skills.filter((item: any) => item.matchState === "MISSING"),
      preferredSkills: skills.filter((item: any) => item.requirementKind === "PREFERRED"),
      minimumExperienceYears: row.minimumExperienceYears === null ? null : Number(row.minimumExperienceYears),
      detectedExperience: row.detectedExperienceYears === null
        ? { kind: "NOT_DETECTED", label: "Not detected" }
        : { kind: "DETECTED", years: Number(row.detectedExperienceYears), label: `${Number(row.detectedExperienceYears)} years detected` },
    };
  }

  private projectAi(row: any, automatic?: AutomaticMatch): AiAssessment {
    const dataQualityNotes = row.findings
      .filter((finding: any) => typeof finding.kind === "string" && finding.kind.startsWith("DATA_QUALITY"))
      .map((finding: any) => {
        const bucket = finding.kind.endsWith("INPUT_LIMITATION") ? "input_limitation" : "extraction_uncertainty";
        return {
          id: finding.id,
          bucket,
          title: humanAiFindingTitle(finding.titleEncrypted),
          evidence: finding.evidenceEncrypted,
        };
      })
      .filter((finding: any, index: number, values: any[]) => values.findIndex((candidate) => aiQualityCategory(candidate.title, candidate.evidence) === aiQualityCategory(finding.title, finding.evidence)) === index);
    const visibleFindings = row.findings
      .filter((finding: any) => !String(finding.kind).startsWith("DATA_QUALITY"))
      .map((finding: any) => {
        const title = humanAiFindingTitle(finding.titleEncrypted);
        return { id: finding.id, kind: finding.kind, title, evidence: finding.evidenceEncrypted };
      })
      .filter((finding: any, index: number, values: any[]) => values.findIndex((candidate) => `${candidate.kind}|${candidate.title}|${candidate.evidence}`.toLocaleLowerCase("en-US") === `${finding.kind}|${finding.title}|${finding.evidence}`.toLocaleLowerCase("en-US")) === index)
      .filter((finding: any, index: number, values: any[]) => finding.kind !== "STRENGTH" || values.findIndex((candidate) => candidate.kind === "STRENGTH" && candidate.evidence.toLocaleLowerCase("en-US") === finding.evidence.toLocaleLowerCase("en-US")) === index);
    const legacyQualityNotes = visibleFindings.filter((finding: any) => ["Data quality review", "Extraction flag", "Input limitation", "Extraction uncertainty"].includes(finding.title));
    const normalizedVisibleFindings = visibleFindings.filter((finding: any) => !["Data quality review", "Extraction flag", "Input limitation", "Extraction uncertainty"].includes(finding.title));
    for (const finding of legacyQualityNotes) {
      const bucket = finding.evidence.startsWith("input_limitation:") ? "input_limitation" : "extraction_uncertainty";
      const title = finding.evidence.match(/date|employment/iu) ? "Employment dates" : finding.evidence.match(/duplicate/iu) ? "Duplicate profile records" : finding.evidence.match(/bullet|responsibilit/iu) ? "Missing responsibilities" : "Input limitation";
      if (!dataQualityNotes.some((note: any) => aiQualityCategory(note.title, note.evidence) === aiQualityCategory(title, finding.evidence))) dataQualityNotes.push({ id: finding.id, bucket, title, evidence: finding.evidence });
    }
    const assessmentLimitedByDataQuality = dataQualityNotes.length > 0 && (row.confidenceLevel === "LOW" || Boolean(row.humanReviewGuidance));
    const fallbackStrengths = automatic
      ? deterministicStrengthFallback(automatic, normalizedVisibleFindings)
      : [];
    return {
      assessmentId: row.id,
      score: Number(row.score),
      confidencePercent: row.confidencePercent,
      confidenceLevel: row.confidenceLevel,
      confidenceLabel: row.confidenceLabel,
      humanReviewGuidance: assessmentLimitedByDataQuality
        ? "Assessment is limited by CV data quality. Review the notes in the CV & Cover letter tab before using the score."
        : row.humanReviewGuidance,
      requiresHumanReview: row.confidenceLevel === "LOW" || Boolean(row.humanReviewGuidance),
      provider: row.providerAdapterVersion,
      modelVersion: row.modelVersion,
      promptVersion: row.promptVersion,
      policyVersion: row.sensitiveAttributePolicyVersion,
      overallSummary: assessmentLimitedByDataQuality
        ? "Low data quality — assessment limited. The CV could not be assessed reliably; manual review is required."
        : row.overallSummaryEncrypted,
      breakdown: [row.technicalAbilitySummaryEncrypted, row.roleFitSummaryEncrypted, row.deductionSummaryEncrypted],
      assessmentLimitedByDataQuality,
      dataQualityNotes,
      // Data-quality warnings should limit confidence, not hide positive
      // evidence. Older published rows may have no AI STRENGTH findings, so
      // project the deterministic matches as a transparent compatibility
      // fallback until the application is rescored with the fixed adapter.
      findings: [...normalizedVisibleFindings, ...fallbackStrengths],
      compliance: { code: "SENSITIVE_ATTRIBUTES_EXCLUDED", label: row.complianceStatementLabel },
      questions: row.questions.length
        ? { kind: "GENERATED", items: row.questions.map((question: any) => ({ question: question.questionEncrypted, pointToVerifyId: question.pointToVerifyFindingId })) }
        : { kind: "INSUFFICIENT_DATA", fallbackMessage: row.questionFallbackLabel ?? "There is not enough evidence to generate suggested questions." },
    };
  }

  async publish(input: Parameters<ScoringRepositoryPort["publish"]>[0]) {
    await this.db.$transaction(async (tx) => {
      const application = await tx.jobApplication.findUnique({ where: { id: input.applicationId }, select: { scoringGeneration: true } });
      if (!application) throw new Error("APPLICATION_UNAVAILABLE");
      const generation = application.scoringGeneration + 1;
      const automatic = await tx.automaticMatchResult.create({
        data: {
          jobApplicationId: input.applicationId,
          jobDescriptionVersionId: input.automatic.jdVersion,
          cvSnapshotVersionId: input.automatic.cvVersion,
          scoringConfigVersionId: input.automatic.configVersion,
          parserBundleVersion: input.automatic.parserVersion,
          score: input.automatic.score,
          requiredSkillPoints: input.automatic.foundRequiredSkills.length + input.automatic.missingRequiredSkills.length === 0
            ? 75
            : (input.automatic.foundRequiredSkills.length / (input.automatic.foundRequiredSkills.length + input.automatic.missingRequiredSkills.length)) * 75,
          experiencePoints: input.automatic.minimumExperienceYears === null || input.automatic.minimumExperienceYears <= 0
            ? 25
            : input.automatic.detectedExperience.kind === "DETECTED"
              ? Math.min(25, (input.automatic.detectedExperience.years / Math.max(1, input.automatic.minimumExperienceYears)) * 25)
              : 0,
          preferredSkillBonus: 0,
          minimumExperienceYears: input.automatic.minimumExperienceYears,
          detectedExperienceYears: input.automatic.detectedExperience.kind === "DETECTED" ? input.automatic.detectedExperience.years : null,
          experienceInterpretationCode: input.automatic.detectedExperience.kind,
          experienceInterpretationLabel: input.automatic.detectedExperience.label,
          mayBeIncomplete: input.automatic.mayBeIncomplete,
          incompletenessLabel: input.automatic.incompletenessLabel,
          computedAt: new Date(),
          skillEvidence: {
            create: [...input.automatic.foundRequiredSkills, ...input.automatic.missingRequiredSkills, ...input.automatic.preferredSkills].map((item) => ({
              skillCanonicalId: item.skillCode,
              skillLabel: item.label,
              requirementKind: item.requirementKind,
              matchState: item.matchState,
              normalizationVersion: SKILL_NORMALIZATION_VERSION,
              excerpts: {
                create: item.evidence.map((excerpt) => ({
                  excerptEncrypted: excerpt.excerpt,
                  ...(excerpt.pageNumber !== undefined ? { pageNumber: excerpt.pageNumber } : {}),
                  ...(excerpt.sectionLabel !== undefined ? { sectionLabel: excerpt.sectionLabel } : {}),
                  cvSnapshotVersionId: excerpt.cvSnapshotVersion,
                  parserVersion: excerpt.parserVersion,
                })),
              },
            })),
          },
          parseResults: {
            create: [input.automatic.cvParse, input.automatic.jdParse].map((status, index) => ({
              documentKind: index === 0 ? "CV" : "JOB_DESCRIPTION",
              snapshotVersion: status.snapshotVersion,
              parserName: "deterministic-parser",
              parserVersion: status.parserVersion,
              schemaVersion: "scoring-evidence-v1",
              status: status.code,
              processingMilliseconds: status.processingMilliseconds,
              safeIssueCodes: [],
              parsedAt: new Date(),
            })),
          },
        },
      });
      const aiInput = input.ai;
      const ai = aiInput ? await tx.aiAssessment.create({
        data: {
          jobApplicationId: input.applicationId,
          automaticMatchResultId: automatic.id,
          score: aiInput.score,
          confidencePercent: aiInput.confidencePercent,
          confidenceLevel: aiInput.confidenceLevel,
          confidenceLabel: aiInput.confidenceLabel,
          humanReviewGuidance: aiInput.humanReviewGuidance,
          providerAdapterVersion: aiInput.provider,
          providerModel: aiInput.modelVersion,
          modelVersion: aiInput.modelVersion,
          promptVersion: aiInput.promptVersion,
          assessmentSchemaVersion: "ai-assessment-v4",
          sensitiveAttributePolicyVersion: aiInput.policyVersion,
          overallSummaryEncrypted: aiInput.overallSummary,
          technicalAbilitySummaryEncrypted: aiInput.breakdown[0] ?? "Not provided",
          roleFitSummaryEncrypted: aiInput.breakdown[1] ?? "Not provided",
          deductionSummaryEncrypted: aiInput.breakdown[2] ?? "Not provided",
          complianceStatementCode: aiInput.compliance.code,
          complianceStatementLabel: aiInput.compliance.label,
          questionState: aiInput.questions.kind,
          questionFallbackLabel: aiInput.questions.kind === "INSUFFICIENT_DATA" ? aiInput.questions.fallbackMessage : null,
          computedAt: new Date(),
          findings: {
            create: [
              ...aiInput.findings.map((finding, ordinal) => ({ kind: finding.kind, titleEncrypted: finding.title, evidenceEncrypted: finding.evidence, ordinal })),
              ...aiInput.dataQualityNotes.map((note, index) => ({
                kind: note.bucket === "input_limitation" ? "DATA_QUALITY_INPUT_LIMITATION" : "DATA_QUALITY_EXTRACTION_UNCERTAINTY",
                titleEncrypted: note.title,
                evidenceEncrypted: note.evidence,
                ordinal: aiInput.findings.length + index,
              })),
            ],
          },
        },
      }) : null;
      const published = await tx.applicationScoringResult.create({
        data: {
          jobApplicationId: input.applicationId,
          generation,
          operationId: input.operationId,
          automaticMatchResultId: automatic.id,
          aiAssessmentId: ai?.id,
          automaticScore: input.automatic.score,
          aiScore: input.ai?.score,
          finalScore: input.finalScore?.value,
          state: input.finalScore ? "SCORED" : "DETERMINISTIC_ONLY",
          formulaVersion: input.finalScore?.formulaVersion ?? "HS-60/40-v1",
          automaticWeight: 0.6,
          aiWeight: 0.4,
          highThreshold: 80,
          mediumThreshold: 60,
          roundingRule: "round-half-up-1-decimal",
          jobDescriptionVersionId: input.automatic.jdVersion,
          cvSnapshotVersionId: input.automatic.cvVersion,
          scoringConfigVersionId: input.automatic.configVersion,
          parserBundleVersion: input.automatic.parserVersion,
          mayBeIncomplete: input.automatic.mayBeIncomplete,
          incompletenessLabel: input.automatic.incompletenessLabel,
          computedAt: new Date(),
          publishedAt: new Date(),
        },
      });
      const fenced = await tx.jobApplication.updateMany({ where: { id: input.applicationId, scoringGeneration: application.scoringGeneration }, data: { scoringGeneration: { increment: 1 }, currentScoringResultId: published.id, scoringStatus: input.finalScore ? "COMPLETED" : "FAILED", aiMatchScore: input.ai?.score ?? null } });
      if (fenced.count !== 1) throw new Error("SCORING_GENERATION_CONFLICT");
      return published;
    });
    const current = await this.findCurrent(input.applicationId);
    if (!current) throw new Error("SCORING_PUBLICATION_UNAVAILABLE");
    return current;
  }

  async setPriority(input: Parameters<ScoringRepositoryPort["setPriority"]>[0]) {
    const row = await this.db.$transaction(async (tx) => {
      const current = await tx.manualApplicationPriority.findFirst({ where: { jobApplicationId: input.applicationId, active: true }, orderBy: { version: "desc" } });
      const expected = current?.version ?? 0;
      if (expected !== input.expectedVersion) throw new Error("PRIORITY_CONFLICT");
      if (current) await tx.manualApplicationPriority.update({ where: { id: current.id }, data: { active: false, removedByUserId: input.actorUserId, removedAt: input.now, removalReasonEncrypted: input.reason } });
      return tx.manualApplicationPriority.create({ data: { jobApplicationId: input.applicationId, value: input.value, reasonEncrypted: input.reason, setByUserId: input.actorUserId, setAt: input.now, version: expected + 1, active: true } });
    });
    return { id: row.id, value: row.value, label: priorityLabel(row.value), reason: row.reasonEncrypted, actorUserId: row.setByUserId, setAt: row.setAt.toISOString(), version: row.version, active: true } satisfies ManualPriority;
  }

  async removePriority(input: Parameters<ScoringRepositoryPort["removePriority"]>[0]) {
    const changed = await this.db.manualApplicationPriority.updateMany({ where: { jobApplicationId: input.applicationId, active: true, version: input.expectedVersion }, data: { active: false, removedByUserId: input.actorUserId, removedAt: input.now, removalReasonEncrypted: input.reason } });
    if (changed.count !== 1) throw new Error("PRIORITY_CONFLICT");
  }
}
