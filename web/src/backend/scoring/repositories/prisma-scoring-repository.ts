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
    const ai = row.aiAssessment ? this.projectAi(row.aiAssessment) : null;
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

  private projectAi(row: any): AiAssessment {
    return {
      assessmentId: row.id,
      score: Number(row.score),
      confidencePercent: row.confidencePercent,
      confidenceLevel: row.confidenceLevel,
      confidenceLabel: row.confidenceLabel,
      humanReviewGuidance: row.humanReviewGuidance,
      provider: row.providerAdapterVersion,
      modelVersion: row.modelVersion,
      promptVersion: row.promptVersion,
      policyVersion: row.sensitiveAttributePolicyVersion,
      overallSummary: row.overallSummaryEncrypted,
      breakdown: [row.technicalAbilitySummaryEncrypted, row.roleFitSummaryEncrypted, row.deductionSummaryEncrypted],
      findings: row.findings.map((finding: any) => ({ id: finding.id, kind: finding.kind, title: finding.titleEncrypted, evidence: finding.evidenceEncrypted })),
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
          requiredSkillPoints: 0,
          experiencePoints: 0,
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
              normalizationVersion: "skill-normalization-v1",
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
      const ai = input.ai ? await tx.aiAssessment.create({
        data: {
          jobApplicationId: input.applicationId,
          automaticMatchResultId: automatic.id,
          score: input.ai.score,
          confidencePercent: input.ai.confidencePercent,
          confidenceLevel: input.ai.confidenceLevel,
          confidenceLabel: input.ai.confidenceLabel,
          humanReviewGuidance: input.ai.humanReviewGuidance,
          providerAdapterVersion: input.ai.provider,
          providerModel: input.ai.modelVersion,
          modelVersion: input.ai.modelVersion,
          promptVersion: input.ai.promptVersion,
          assessmentSchemaVersion: "ai-assessment-v1",
          sensitiveAttributePolicyVersion: input.ai.policyVersion,
          overallSummaryEncrypted: input.ai.overallSummary,
          technicalAbilitySummaryEncrypted: input.ai.breakdown[0] ?? "Not provided",
          roleFitSummaryEncrypted: input.ai.breakdown[1] ?? "Not provided",
          deductionSummaryEncrypted: input.ai.breakdown[2] ?? "Not provided",
          complianceStatementCode: input.ai.compliance.code,
          complianceStatementLabel: input.ai.compliance.label,
          questionState: input.ai.questions.kind,
          questionFallbackLabel: input.ai.questions.kind === "INSUFFICIENT_DATA" ? input.ai.questions.fallbackMessage : null,
          computedAt: new Date(),
          findings: { create: input.ai.findings.map((finding, ordinal) => ({ kind: finding.kind, titleEncrypted: finding.title, evidenceEncrypted: finding.evidence, ordinal })) },
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
      const fenced = await tx.jobApplication.updateMany({ where: { id: input.applicationId, scoringGeneration: application.scoringGeneration }, data: { scoringGeneration: { increment: 1 }, currentScoringResultId: published.id } });
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
