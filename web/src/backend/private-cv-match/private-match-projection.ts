import "server-only";

import {
  privateMatchResponseSchema,
  privateMatchStatusSchema,
  type PrivateMatchStatus,
  type PrivateMatchResponse,
} from "@/shared/contracts/private-cv-match";
import type { PrivateCheckRecord } from "@/backend/repositories/private-cv-match/prisma-private-cv-match-repository";
import { jsonRecord } from "./private-match-types";

function numberValue(value: unknown, fallback = 0): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function boundedText(value: unknown, fallback: string, max: number): string {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : fallback;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function snapshot<T>(value: unknown): T {
  return value as T;
}

function completedDurationSeconds(
  startedAt: Date | null,
  completedAt: Date | null,
): number | null {
  if (!startedAt || !completedAt) return null;
  return Math.max(
    0,
    Math.round((completedAt.getTime() - startedAt.getTime()) / 100) / 10,
  );
}

function provenance(check: PrivateCheckRecord) {
  const attempt = check.currentAttempt;
  return {
    cvVersionId: check.cvVersionId,
    cvVersion: check.cvVersion,
    jdVersion: check.jdVersion,
    scoringConfigVersion: check.scoringConfigVersion,
    aiProvider: attempt?.provider ?? null,
    aiModel: attempt?.model ?? null,
    promptVersion: attempt?.promptVersion ?? null,
    inputPolicyVersion: attempt?.inputPolicyVersion ?? null,
  };
}

function base(check: PrivateCheckRecord) {
  const cv = snapshot<{
    versionId: string;
    version: number;
    displayName: string;
    fileName: string;
    mimeType:
      | "application/pdf"
      | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    byteSize: number;
    pageCount: number | null;
    parseStatus: "READY" | "PARTIAL" | "FAILED";
    confirmedAt: string;
  }>(check.cvSnapshot);
  const job = snapshot<{
    jobId: string;
    slug: string;
    title: string;
    company: string;
    location: string;
    employmentType: string;
    workArrangement: string;
    requiredExperienceYears: number | null;
    requirements: string[];
    jdVersion: number;
    jdUpdatedAt: string;
  }>(check.jdSnapshot);
  return {
    checkId: check.id,
    createdAt: check.createdAt.toISOString(),
    expiresAt: check.expiresAt.toISOString(),
    provenance: provenance(check),
    cv: {
      versionId: boundedText(cv.versionId, check.cvVersionId, 128),
      version: Number(cv.version) || check.cvVersion,
      displayName: boundedText(cv.displayName, "CV", 200),
      fileName: boundedText(cv.fileName, "candidate-cv", 255),
      mimeType: cv.mimeType,
      byteSize: Math.max(1, numberValue(cv.byteSize)),
      pageCount:
        cv.pageCount === null ? null : Math.max(1, numberValue(cv.pageCount)),
      parseStatus: cv.parseStatus ?? "READY",
      confirmedAt: cv.confirmedAt ?? check.createdAt.toISOString(),
    },
    job: {
      jobId: boundedText(job.jobId, check.jobPostingId, 128),
      slug: boundedText(job.slug, job.jobId, 200),
      title: boundedText(job.title, "Selected job", 200),
      company: boundedText(job.company, "Company", 200),
      location: boundedText(job.location, "Location not specified", 200),
      employmentType: boundedText(job.employmentType, "Full-time", 80),
      workArrangement: boundedText(job.workArrangement, "On-site", 80),
      requiredExperienceYears:
        job.requiredExperienceYears === null
          ? null
          : Math.max(0, numberValue(job.requiredExperienceYears)),
      requirements: arrayValue(job.requirements)
        .filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0,
        )
        .map((item) => item.slice(0, 200))
        .slice(0, 100),
      jdVersion: Number(job.jdVersion) || check.jdVersion,
      jdUpdatedAt: job.jdUpdatedAt ?? check.createdAt.toISOString(),
    },
  };
}

function automaticComponent(
  result: NonNullable<
    PrivateCheckRecord["currentAttempt"]
  >["deterministicResultByAttempt"],
) {
  if (!result) return null;
  const matched = arrayValue(result.matchedRequirements).flatMap((value) => {
    const item = jsonRecord(value as never);
    if (typeof item.id !== "string" || typeof item.label !== "string")
      return [];
    const kind = item.kind === "PREFERRED" ? "PREFERRED" : "REQUIRED";
    return [
      {
        id: item.id.slice(0, 128),
        label: item.label.slice(0, 200),
        kind,
        matched: item.matched === true,
      },
    ];
  });
  const gaps = arrayValue(result.gaps).flatMap((value) => {
    const item = jsonRecord(value as never);
    if (typeof item.code !== "string" || typeof item.title !== "string")
      return [];
    const kind =
      item.kind === "PREFERRED" || item.kind === "EXPERIENCE"
        ? item.kind
        : "REQUIRED";
    return [
      {
        code: item.code.slice(0, 160),
        title: item.title.slice(0, 300),
        description: boundedText(
          item.description,
          "No direct evidence was found.",
          500,
        ),
        kind,
      },
    ];
  });
  const criterionLabels = new Map(matched.map((item) => [item.id, item.label]));
  const evidence = result.evidence.flatMap((item) => {
    const location = jsonRecord(item.location);
    const confidence = numberValue(
      jsonRecord(item.confidenceMetadata).confidence,
      0.5,
    );
    const type = [
      "SKILL",
      "PROJECT",
      "IMPACT",
      "EXPERIENCE",
      "EDUCATION",
      "OTHER",
    ].includes(item.classification)
      ? item.classification
      : "OTHER";
    return item.quote.trim()
      ? [
          {
            type: type as
              | "SKILL"
              | "PROJECT"
              | "IMPACT"
              | "EXPERIENCE"
              | "EDUCATION"
              | "OTHER",
            quote: item.quote.slice(0, 1_000),
            criterion: (
              criterionLabels.get(item.criterionId) ?? item.criterionId
            ).slice(0, 300),
            location: `${boundedText(location.section, "CV body", 120)}${location.page ? ` · p.${numberValue(location.page)}` : ""}`,
            confidence: Math.min(1, Math.max(0, confidence)),
          },
        ]
      : [];
  });
  return {
    score: numberValue(result.score),
    weight: 0.6 as const,
    weightedContribution: numberValue(result.weightedContribution),
    evidenceCoverage: numberValue(result.evidenceCoverage),
    evidenceConfidence: Math.min(
      100,
      Math.max(0, Math.round(numberValue(result.evidenceCoverage) * 0.95)),
    ),
    matchedRequirements: matched,
    gaps,
    requiredExperience:
      result.requiredExperience === null
        ? null
        : numberValue(result.requiredExperience),
    detectedExperience:
      result.detectedExperience === null
        ? null
        : numberValue(result.detectedExperience),
    evidence,
    parserProvenance: {
      parserVersion: boundedText(
        jsonRecord(result.parserProvenance).parserVersion,
        "private-cv-match-parser-v1",
        80,
      ),
      cvStatus: boundedText(
        jsonRecord(result.parserProvenance).cvStatus,
        "Parsed successfully",
        80,
      ),
      jdStatus: boundedText(
        jsonRecord(result.parserProvenance).jdStatus,
        "Current job",
        80,
      ),
    },
    mayBeIncomplete: result.mayBeIncomplete,
  };
}

function aiComponent(
  result: NonNullable<
    PrivateCheckRecord["currentAttempt"]
  >["aiResultByAttempt"],
) {
  if (!result) return null;
  const strengths = arrayValue(result.strengths)
    .flatMap((value) => {
      const item = jsonRecord(value as never);
      return typeof item.title === "string" && typeof item.evidence === "string"
        ? [
            {
              title: item.title.slice(0, 160),
              evidence: item.evidence.slice(0, 1_000),
            },
          ]
        : [];
    })
    .slice(0, 4);
  const actions = arrayValue(result.actions)
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    )
    .map((value) => value.slice(0, 500))
    .slice(0, 4);
  return {
    score: numberValue(result.score),
    weight: 0.4 as const,
    weightedContribution: numberValue(result.weightedContribution),
    summary: boundedText(
      result.summary,
      "The AI evaluation is complete.",
      1_000,
    ),
    strengths,
    mainGap: result.mainGap ? result.mainGap.slice(0, 1_000) : null,
    actions,
    evidenceConfidence: Math.min(
      100,
      Math.max(0, Math.round(result.evidenceConfidence)),
    ),
    evidenceLevel:
      result.evidenceLevel === "LOW" || result.evidenceLevel === "MEDIUM"
        ? result.evidenceLevel
        : "HIGH",
    provider: boundedText(result.provider, "OpenAI", 100),
    model: boundedText(result.model, "gpt-5.4-mini-2026-03-17", 200),
    promptVersion: boundedText(
      result.promptVersion,
      "private-cv-match-prompt-v1",
      100,
    ),
    policyVersion: boundedText(result.policyVersion, "HS-60/40-v1", 100),
    durationMs: Math.max(0, Math.round(result.durationMs)),
    completedAt: result.completedAt.toISOString(),
  };
}

function deterministicResult(
  attempt: NonNullable<PrivateCheckRecord["currentAttempt"]> | null | undefined,
) {
  // Initial attempts own the deterministic row through
  // `deterministicResultByAttempt`. An AI retry reuses that immutable row via
  // `deterministicResultId`, so its direct relation is `deterministicResult`.
  return (
    attempt?.deterministicResultByAttempt ??
    attempt?.deterministicResult ??
    null
  );
}

function retryInProgress(check: PrivateCheckRecord, now: Date): boolean {
  return check.attempts.some(
    (attempt) =>
      attempt.trigger === "AI_RETRY" &&
      (attempt.state === "QUEUED" ||
        (attempt.state === "AI_RUNNING" &&
          attempt.leaseExpiresAt !== null &&
          attempt.leaseExpiresAt > now)),
  );
}

export function projectPrivateMatchCheck(
  check: PrivateCheckRecord,
  now = new Date(),
): PrivateMatchResponse {
  const common = base(check);
  const attempt = check.currentAttempt;
  const automatic = automaticComponent(deterministicResult(attempt));
  if (attempt?.state === "READY" && automatic && attempt.aiResultByAttempt) {
    const aiEvaluation = aiComponent(attempt.aiResultByAttempt);
    if (aiEvaluation) {
      return privateMatchResponseSchema.parse({
        ...common,
        view: "FULL_REPORT",
        state: "READY",
        mode: "HYBRID",
        hybridScore: numberValue(attempt.hybridScore),
        matchBand:
          attempt.matchBand === "HIGH_MATCH" ||
          attempt.matchBand === "MEDIUM_MATCH"
            ? attempt.matchBand
            : "LOW_MATCH",
        automatic,
        aiEvaluation,
        evidenceConfidence: aiEvaluation.evidenceConfidence,
        summary: aiEvaluation.summary,
        actions: aiEvaluation.actions,
        canApply: true,
        completedAt: (attempt.completedAt ?? now).toISOString(),
        retryInProgress: retryInProgress(check, now),
      });
    }
  }
  if (attempt?.state === "LIMITED" && automatic) {
    return privateMatchResponseSchema.parse({
      ...common,
      view: "LIMITED_REPORT",
      state: "LIMITED",
      mode: "LIMITED",
      automatic,
      aiEvaluation: null,
      hybridScore: null,
      matchBand: null,
      canRetryAi: true,
      canApply: true,
      retryInProgress: retryInProgress(check, now),
      completedAt: (attempt.completedAt ?? now).toISOString(),
      failureCode: attempt.failureCode,
    });
  }
  const statusState =
    check.state === "ANALYZING"
      ? "ANALYZING"
      : check.state === "FAILED"
        ? "FAILED"
        : "QUEUED";
  const statusAttempt =
    check.attempts.find((item) => item.state === "FAILED") ?? check.attempts[0];
  return privateMatchResponseSchema.parse({
    ...common,
    view: "STATUS",
    state: statusState,
    failureCode: statusAttempt?.failureCode ?? null,
    durationSeconds: completedDurationSeconds(
      statusAttempt?.startedAt ?? null,
      statusAttempt?.completedAt ?? null,
    ),
  });
}

export function projectPrivateMatchStatus(
  check: PrivateCheckRecord,
): PrivateMatchStatus {
  const common = base(check);
  const attempt =
    check.attempts.find((item) => item.state === "FAILED") ?? check.attempts[0];
  const state =
    check.state === "FAILED"
      ? "FAILED"
      : check.state === "ANALYZING"
        ? "ANALYZING"
        : "QUEUED";
  return privateMatchStatusSchema.parse({
    ...common,
    view: "STATUS",
    state,
    failureCode: attempt?.failureCode ?? null,
    durationSeconds: completedDurationSeconds(
      attempt?.startedAt ?? null,
      attempt?.completedAt ?? null,
    ),
  });
}
