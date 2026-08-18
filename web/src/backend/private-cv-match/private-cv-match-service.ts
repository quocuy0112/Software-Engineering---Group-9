import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/backend/database/prisma";
import { normalizeSearchText } from "@/backend/services/jobs/search-normalization";
import {
  PrivateCvMatchRepository,
  type PrivateCheckRecord,
  type PrivateCheckListRecord,
} from "@/backend/repositories/private-cv-match/prisma-private-cv-match-repository";
import { createPrivateMatchRequestSchema } from "@/shared/contracts/private-cv-match";
import type { CreatePrivateMatchRequest } from "@/shared/contracts/private-cv-match";
import { privateMatchError, PrivateCvMatchError } from "./private-match-errors";
import type {
  PrivateCvSnapshot,
  PrivateJdSnapshot,
} from "./private-match-types";

export const PRIVATE_SCORING_CONFIG_VERSION = "HS-60/40-v1";
export const PRIVATE_PARSER_VERSION = "private-cv-match-parser-v1";

export { PrivateCvMatchError } from "./private-match-errors";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/u;

export type PrivateMatchEnqueue = (checkId: string) => Promise<void>;

async function defaultEnqueue(): Promise<void> {
  // The durable queue is the attempt row itself. In a long-lived web process
  // this opportunistically starts one worker turn; the standalone worker
  // script continuously drains the same rows in deployments without a
  // background task runtime.
  const worker = await import("./private-match-worker");
  await worker.processPrivateMatchWorkOnce();
}

export type PrivateCvMatchServiceOptions = Readonly<{
  repository?: PrivateCvMatchRepository;
  enqueue?: PrivateMatchEnqueue;
  now?: () => Date;
}>;

type CandidateCvSource = Readonly<{
  id: string;
  displayName: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  checksumSha256: string;
  version: number;
  confirmedAt: Date | null;
  archivedAt: Date | null;
}>;

export type JobSource = Readonly<{
  id: string;
  slug: string;
  title: string;
  description: string;
  responsibilities: string;
  requirements: string;
  location: string;
  employmentType: string;
  workArrangement: string;
  experienceLevel: string;
  version: number;
  updatedAt: Date;
  applicationDeadline: Date | null;
  company: { displayName: string };
  skills: readonly {
    skillId: string;
    displayName: string;
    required: boolean;
  }[];
}>;

const privateMatchJobSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  responsibilities: true,
  requirements: true,
  location: true,
  employmentType: true,
  workArrangement: true,
  experienceLevel: true,
  version: true,
  updatedAt: true,
  applicationDeadline: true,
  company: { select: { displayName: true } },
  skills: {
    orderBy: { position: "asc" as const },
    select: { skillId: true, displayName: true, required: true },
  },
} as const;

function privateMatchJobWhere(now: Date, jobId?: string) {
  return {
    ...(jobId ? { id: jobId } : {}),
    status: "ACTIVE" as const,
    approvedAt: { not: null },
    publishedAt: { not: null, lte: now },
    closedAt: null,
    removedAt: null,
    AND: [
      {
        OR: [
          { applicationDeadline: null },
          { applicationDeadline: { gt: now } },
        ],
      },
      {
        OR: [
          { reviewAggregate: null },
          {
            reviewAggregate: {
              is: { approvedVersionId: { not: null }, closedAt: null },
            },
          },
        ],
      },
    ],
    company: {
      // Candidate discovery uses the verifiedAt marker as the public
      // eligibility boundary. Keep private checks on that same boundary;
      // older public-job fixtures can legitimately have UNVERIFIED as the
      // legacy state while retaining a valid verifiedAt timestamp.
      verifiedAt: { not: null },
      verificationState: { not: "INACTIVE" as const },
      verificationInactiveAt: null,
    },
  };
}

function privateMatchJobSearchWhere(now: Date, query: string) {
  const base = privateMatchJobWhere(now);
  const tokens = normalizeSearchText(query.slice(0, 200))
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 8);
  if (!tokens.length) return base;

  return {
    ...base,
    AND: [
      ...base.AND,
      ...tokens.map((token) => ({
        OR: [
          { normalizedTitle: { contains: token } },
          { searchDocumentNormalized: { contains: token } },
          {
            company: {
              OR: [
                {
                  displayName: {
                    contains: token,
                    mode: "insensitive" as const,
                  },
                },
                {
                  legalName: { contains: token, mode: "insensitive" as const },
                },
              ],
            },
          },
        ],
      })),
    ],
  };
}

export async function findEligiblePrivateMatchJob(
  jobId: string,
  now = new Date(),
) {
  return prisma.jobPosting.findFirst({
    where: privateMatchJobWhere(now, jobId),
    select: privateMatchJobSelect,
  });
}

export async function listEligiblePrivateMatchJobs(now = new Date()) {
  return prisma.jobPosting.findMany({
    where: privateMatchJobWhere(now),
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    take: 200,
    select: privateMatchJobSelect,
  });
}

export async function searchEligiblePrivateMatchJobs(
  query: string,
  now = new Date(),
) {
  return prisma.jobPosting.findMany({
    where: privateMatchJobSearchWhere(now, query.slice(0, 200)),
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    take: 50,
    select: privateMatchJobSelect,
  });
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, nested) => {
    if (!nested || typeof nested !== "object" || Array.isArray(nested))
      return nested;
    return Object.fromEntries(
      Object.entries(nested as Record<string, unknown>).sort(([a], [b]) =>
        a.localeCompare(b),
      ),
    );
  });
}

function lines(value: string, limit = 100): string[] {
  return value
    .split(/\r?\n|[•·]/u)
    .map((line) => line.replace(/^[-*\d.)\s]+/u, "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function safeText(value: string, max: number): string {
  const normalized = value.normalize("NFKC");
  return Array.from(normalized, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? " " : character;
  })
    .join("")
    .trim()
    .slice(0, max);
}

function twelveMonthsFrom(value: Date): Date {
  const result = new Date(value);
  result.setUTCMonth(result.getUTCMonth() + 12);
  return result;
}

function cvSnapshot(row: CandidateCvSource): PrivateCvSnapshot {
  const checksum = /^[a-f0-9]{64}$/iu.test(row.checksumSha256)
    ? row.checksumSha256.toLowerCase()
    : sha256(`${row.id}|${row.version}|${row.fileName}|${row.byteSize}`);
  return {
    versionId: row.id,
    version: row.version,
    displayName: safeText(row.displayName, 200) || row.fileName,
    fileName: safeText(row.fileName, 255) || "candidate-cv",
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    pageCount: null,
    parseStatus: "READY",
    confirmedAt: (row.confirmedAt ?? new Date(0)).toISOString(),
    checksumSha256: checksum,
  };
}

function jobSnapshot(row: JobSource): PrivateJdSnapshot {
  const requiredSkills = row.skills
    .filter((skill) => skill.required)
    .map((skill) => ({
      code: safeText(skill.skillId, 128),
      label: safeText(skill.displayName, 200),
    }))
    .filter((skill) => skill.code && skill.label);
  const preferredSkills = row.skills
    .filter((skill) => !skill.required)
    .map((skill) => ({
      code: safeText(skill.skillId, 128),
      label: safeText(skill.displayName, 200),
    }))
    .filter((skill) => skill.code && skill.label);
  const requirements = [
    ...requiredSkills.map((skill) => skill.label),
    ...lines(row.requirements),
    ...lines(row.responsibilities, 30),
  ]
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 100);
  const jdText = JSON.stringify({
    title: safeText(row.title, 200),
    description: safeText(row.description, 80_000),
    responsibilities: safeText(row.responsibilities, 80_000),
    requirements: safeText(row.requirements, 80_000),
    requiredSkills,
    preferredSkills,
  });
  const requiredExperienceYears =
    {
      ENTRY: 0,
      JUNIOR: 1,
      MID: 3,
      SENIOR: 5,
      LEAD: 7,
      MANAGER: 5,
    }[row.experienceLevel] ?? null;
  return {
    jobId: row.id,
    slug: safeText(row.slug, 200),
    title: safeText(row.title, 200),
    company: safeText(row.company.displayName, 200) || "Company",
    location: safeText(row.location, 200) || "Location not specified",
    employmentType: String(row.employmentType),
    workArrangement: String(row.workArrangement),
    requiredExperienceYears,
    requirements,
    requiredSkills,
    preferredSkills,
    requiredLanguages: [],
    jdVersion: row.version,
    jdUpdatedAt: row.updatedAt.toISOString(),
    jdText,
  };
}

export function projectPrivateMatchJob(row: JobSource) {
  const snapshot = jobSnapshot(row);
  return {
    jobId: snapshot.jobId,
    slug: snapshot.slug,
    title: snapshot.title,
    company: snapshot.company,
    location: snapshot.location,
    employmentType: snapshot.employmentType,
    workArrangement: snapshot.workArrangement,
    requiredExperienceYears: snapshot.requiredExperienceYears,
    requirements: [...snapshot.requirements],
    jdVersion: snapshot.jdVersion,
    jdUpdatedAt: snapshot.jdUpdatedAt,
  };
}

function errorCode(error: unknown): string {
  return error instanceof Error ? error.message : "PRIVATE_MATCH_CREATE_FAILED";
}

function snapshotRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function listItem(check: PrivateCheckListRecord) {
  const cv = snapshotRecord(check.cvSnapshot);
  const job = snapshotRecord(check.jdSnapshot);
  const attempt = check.currentAttempt;
  const deterministic =
    attempt?.deterministicResultByAttempt ?? attempt?.deterministicResult;
  const state =
    check.state === "READY" && attempt?.state === "READY"
      ? "READY"
      : check.state === "LIMITED" && attempt?.state === "LIMITED"
        ? "LIMITED"
        : check.state === "FAILED"
          ? "FAILED"
          : check.state === "ANALYZING"
            ? "ANALYZING"
            : "QUEUED";

  return {
    checkId: check.id,
    state,
    createdAt: check.createdAt.toISOString(),
    expiresAt: check.expiresAt.toISOString(),
    job: {
      jobId: typeof job.jobId === "string" ? job.jobId : check.jobPostingId,
      slug: typeof job.slug === "string" ? job.slug : check.jobPostingId,
      title: typeof job.title === "string" ? job.title : "Selected job",
      company: typeof job.company === "string" ? job.company : "Company",
      location:
        typeof job.location === "string"
          ? job.location
          : "Location not specified",
    },
    cv: {
      versionId:
        typeof cv.versionId === "string" ? cv.versionId : check.cvVersionId,
      displayName: typeof cv.displayName === "string" ? cv.displayName : "CV",
      fileName: typeof cv.fileName === "string" ? cv.fileName : "candidate-cv",
      version: typeof cv.version === "number" ? cv.version : check.cvVersion,
    },
    hybridScore:
      state === "READY" && typeof attempt?.hybridScore === "number"
        ? attempt.hybridScore
        : null,
    deterministicScore:
      deterministic && typeof deterministic.score === "number"
        ? deterministic.score
        : null,
  };
}

export class PrivateCvMatchService {
  private readonly repository: PrivateCvMatchRepository;
  private readonly enqueue: PrivateMatchEnqueue;
  private readonly clock: () => Date;

  constructor(options: PrivateCvMatchServiceOptions = {}) {
    this.repository = options.repository ?? new PrivateCvMatchRepository();
    this.enqueue = options.enqueue ?? defaultEnqueue;
    this.clock = options.now ?? (() => new Date());
  }

  async create(
    candidateUserId: string,
    request: CreatePrivateMatchRequest,
    idempotencyKey: string,
  ): Promise<{ check: PrivateCheckRecord; replay: boolean }> {
    const parsed = createPrivateMatchRequestSchema.safeParse(request);
    if (!parsed.success || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      throw privateMatchError("INVALID_REQUEST", 400);
    }
    const now = this.clock();
    const requestDigest = sha256(canonicalJson(parsed.data));
    const priorReceipt = await this.repository.findCommandReceipt({
      candidateUserId,
      idempotencyKey,
      commandKind: "CREATE",
    });
    if (priorReceipt) {
      if (priorReceipt.requestDigest !== requestDigest) {
        throw privateMatchError("CONFLICT", 409);
      }
      const prior = await this.repository.findOwnedCheck(
        candidateUserId,
        priorReceipt.checkId,
        now,
      );
      if (!prior) throw privateMatchError("UNAVAILABLE", 404);
      return { check: prior, replay: true };
    }

    const [cv, job] = await Promise.all([
      prisma.candidateCv.findFirst({
        where: { id: parsed.data.cvVersionId, candidateUserId },
        select: {
          id: true,
          displayName: true,
          fileName: true,
          mimeType: true,
          byteSize: true,
          checksumSha256: true,
          version: true,
          confirmedAt: true,
          archivedAt: true,
        },
      }),
      findEligiblePrivateMatchJob(parsed.data.jobId, now),
    ]);
    if (!cv) throw privateMatchError("CV_UNAVAILABLE", 404);
    if (cv.archivedAt) throw privateMatchError("CV_UNAVAILABLE", 404);
    if (!cv.confirmedAt) throw privateMatchError("CV_NOT_PARSED", 404);
    if (
      cv.mimeType !== "application/pdf" &&
      cv.mimeType !==
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      throw privateMatchError("CV_UNAVAILABLE", 404);
    }
    if (!job) throw privateMatchError("JOB_UNAVAILABLE", 404);

    const candidateCv = cvSnapshot(cv);
    const jobPosting = jobSnapshot(job);
    const cvDigest = candidateCv.checksumSha256;
    const jdDigest = sha256(canonicalJson(jobPosting));
    const creationDedupeKey = sha256(
      `${candidateUserId}|${jobPosting.jobId}|${candidateCv.versionId}`,
    );
    const active = await this.repository.findActiveByDedupeKey(
      candidateUserId,
      creationDedupeKey,
      now,
    );
    if (active) {
      try {
        await this.repository.createCommandReceipt({
          candidateUserId,
          idempotencyKey,
          commandKind: "CREATE",
          requestDigest,
          checkId: active.id,
        });
      } catch {
        // A concurrent identical request may already have installed the
        // receipt. Returning the same active check is still idempotent.
      }
      return { check: active, replay: true };
    }

    const expiresAt = twelveMonthsFrom(now);
    try {
      const created = await this.repository.withTransaction(
        async (transaction) => {
          const duplicate = await transaction.findActiveByDedupeKey(
            candidateUserId,
            creationDedupeKey,
            now,
          );
          if (duplicate) return duplicate;
          const check = await transaction.createCheck({
            id: `pmc_${randomUUID()}`,
            candidateUserId,
            cvVersionId: candidateCv.versionId,
            cvVersion: candidateCv.version,
            cvDigest,
            jobPostingId: jobPosting.jobId,
            jdVersion: jobPosting.jdVersion,
            jdDigest,
            scoringConfigVersion: PRIVATE_SCORING_CONFIG_VERSION,
            creationDedupeKey,
            cvSnapshot: candidateCv,
            jdSnapshot: jobPosting,
            expiresAt,
            createdAt: now,
          });
          await transaction.createCommandReceipt({
            candidateUserId,
            idempotencyKey,
            commandKind: "CREATE",
            requestDigest,
            checkId: check.id,
          });
          return check;
        },
      );
      void this.enqueue(created.id).catch(() => undefined);
      return { check: created, replay: false };
    } catch (error) {
      const message = errorCode(error);
      if (message.includes("Unique constraint") || message.includes("P2002")) {
        const duplicate = await this.repository.findActiveByDedupeKey(
          candidateUserId,
          creationDedupeKey,
          now,
        );
        if (duplicate) return { check: duplicate, replay: true };
      }
      if (error instanceof PrivateCvMatchError) throw error;
      throw privateMatchError("INTERNAL_FAILURE", 503);
    }
  }

  async get(
    candidateUserId: string,
    checkId: string,
  ): Promise<PrivateCheckRecord> {
    const check = await this.repository.findOwnedCheck(
      candidateUserId,
      checkId,
      this.clock(),
    );
    if (!check) throw privateMatchError("UNAVAILABLE", 404);
    return check;
  }

  async list(candidateUserId: string) {
    const checks = await this.repository.listOwnedChecks(
      candidateUserId,
      this.clock(),
      50,
    );
    return { items: checks.map(listItem) };
  }

  async delete(candidateUserId: string, checkId: string): Promise<void> {
    const revoked = await this.repository.revokeOwnedCheck(
      candidateUserId,
      checkId,
      this.clock(),
    );
    if (!revoked) throw privateMatchError("UNAVAILABLE", 404);
  }

  async retryAi(
    candidateUserId: string,
    checkId: string,
    idempotencyKey: string,
  ): Promise<{ check: PrivateCheckRecord; replay: boolean }> {
    if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      throw privateMatchError("INVALID_REQUEST", 400);
    }
    const now = this.clock();
    const requestDigest = sha256(
      canonicalJson({ checkId, command: "RETRY_AI" }),
    );
    const priorReceipt = await this.repository.findCommandReceipt({
      candidateUserId,
      idempotencyKey,
      commandKind: "RETRY_AI",
    });
    if (priorReceipt) {
      if (priorReceipt.requestDigest !== requestDigest) {
        throw privateMatchError("CONFLICT", 409);
      }
      const check = await this.repository.findOwnedCheck(
        candidateUserId,
        checkId,
        now,
      );
      if (!check) throw privateMatchError("UNAVAILABLE", 404);
      return { check, replay: true };
    }
    // Establish the same owner-and-availability boundary used by GET before
    // attempting to create a retry. This keeps missing, expired, deleted, and
    // cross-owner checks indistinguishable from every retry outcome.
    await this.get(candidateUserId, checkId);
    try {
      await this.repository.withTransaction(async (transaction) => {
        await transaction.createAiRetryAttempt({
          candidateUserId,
          checkId,
          now,
          scoringPolicyVersion: PRIVATE_SCORING_CONFIG_VERSION,
        });
        await transaction.createCommandReceipt({
          candidateUserId,
          idempotencyKey,
          commandKind: "RETRY_AI",
          requestDigest,
          checkId,
        });
      });
      void this.enqueue(checkId).catch(() => undefined);
      const check = await this.get(candidateUserId, checkId);
      return { check, replay: false };
    } catch (error) {
      if (error instanceof PrivateCvMatchError) throw error;
      if (
        error instanceof Error &&
        error.message === "PRIVATE_CHECK_UNAVAILABLE"
      ) {
        throw privateMatchError("UNAVAILABLE", 404);
      }
      if (
        error instanceof Error &&
        error.message === "PRIVATE_RETRY_NOT_ALLOWED"
      ) {
        // The eligibility check and attempt insert run in a transaction, but
        // two browser tabs can still observe the same report before either
        // retry commits. Re-read the authoritative check once: if another
        // request has already installed a live retry, treat this request as
        // an accepted duplicate instead of surfacing a misleading 409.
        const current = await this.repository.findOwnedCheck(
          candidateUserId,
          checkId,
          now,
        );
        const activeRetry = current?.attempts.some(
          (attempt) =>
            attempt.trigger === "AI_RETRY" &&
            (attempt.state === "QUEUED" ||
              (attempt.state === "AI_RUNNING" &&
                attempt.leaseExpiresAt !== null &&
                attempt.leaseExpiresAt > now)),
        );
        if (current && activeRetry) {
          void this.enqueue(checkId).catch(() => undefined);
          return { check: current, replay: false };
        }
        throw privateMatchError("CONFLICT", 409);
      }
      if (
        error instanceof Error &&
        (error.message.includes("Unique constraint") ||
          error.message.includes("P2002"))
      ) {
        // A concurrent request with the same idempotency key may have won the
        // attempt/receipt race. Replay that command; a different key is a
        // genuine retry conflict and must not create a second attempt.
        const concurrentReceipt = await this.repository.findCommandReceipt({
          candidateUserId,
          idempotencyKey,
          commandKind: "RETRY_AI",
        });
        if (concurrentReceipt) {
          if (concurrentReceipt.requestDigest !== requestDigest) {
            throw privateMatchError("CONFLICT", 409);
          }
          const check = await this.repository.findOwnedCheck(
            candidateUserId,
            checkId,
            now,
          );
          if (!check) throw privateMatchError("UNAVAILABLE", 404);
          return { check, replay: true };
        }
        throw privateMatchError("CONFLICT", 409);
      }
      throw privateMatchError("INTERNAL_FAILURE", 503);
    }
  }
}
