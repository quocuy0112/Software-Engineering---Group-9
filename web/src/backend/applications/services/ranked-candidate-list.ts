import "server-only";

import { prisma } from "@/backend/database/prisma";
import { RecruiterApplicationAuthorization } from "../authorization/recruiter-application-authorization";
import {
  rankedApplicationPageSchema,
  type RankedApplicationPage,
  type RankedApplicationRow,
} from "@/shared/contracts/scoring";
import {
  decodeRankingCursor,
  encodeRankingCursor,
} from "@/backend/scoring/pagination/ranking-cursor";
import {
  normalizedRankingFilterHash,
  PrismaRankingSnapshotRepository,
} from "@/backend/scoring/pagination/ranking-snapshot-repository";
import {
  automaticScoreConfigForPublishedResult,
  getAutomaticScoreStageRuleConfig,
  type AutomaticScoreStageRuleConfig,
} from "@/backend/applications/services/automatic-score-stage-config";

type RankingFilters = Readonly<{
  limit: number;
  page?: number;
  cursor?: string;
  sort: "FINAL_SCORE" | "MANUAL_PRIORITY" | "SUBMITTED_AT";
  search?: string;
  minScore?: number;
  maxScore?: number;
  skill?: string;
  minExperience?: number;
  stage:
    | "ACTIVE_PIPELINE"
    | "ALL"
    | "APPLIED"
    | "VIEWED"
    | "SHORTLISTED"
    | "INTERVIEWING"
    | "OFFERED"
    | "HIRED"
    | "OFFER_DECLINED"
    | "REJECTED"
    | "WAITLISTED"
    | "WITHDRAWN";
  scoringStatus:
    | "ALL"
    | "PROCESSING"
    | "SCORED"
    | "UNAVAILABLE"
    | "FAILED"
    | "NOT_CALCULATED";
}>;

const priorityOrder: Record<string, number> = {
  HIGH: 0,
  NORMAL: 1,
  LOW: 2,
  HOLD: 3,
};

type RankedSourceRow = Readonly<{
  id: string;
  scoringStatus: string;
  currentScoringResultId: string | null;
  currentScoringResult: { state: string; finalScore: unknown } | null;
}>;

function stateFor(row: RankedSourceRow) {
  if (row.scoringStatus === "PENDING")
    return {
      kind: "PENDING",
      label: "Pending",
      operationId: `retry-${row.id}`,
    } as const;
  if (!row.currentScoringResultId) {
    if (row.scoringStatus === "NOT_REQUESTED")
      return { kind: "NOT_CALCULATED", label: "Not calculated" } as const;
    if (row.scoringStatus === "FAILED")
      return { kind: "FAILED", label: "Scoring failed" } as const;
    return {
      kind: "PROCESSING",
      label: "Processing",
      operationId: `initial-${row.id}`,
    } as const;
  }
  if (
    row.currentScoringResult?.state === "SCORED" &&
    row.currentScoringResult.finalScore !== null
  )
    return { kind: "SCORED", label: "Scored" } as const;
  return { kind: "UNAVAILABLE", label: "Unavailable" } as const;
}

function snapshotStateFor(
  state: string,
  snapshotId: string,
): RankedApplicationRow["scoring"] {
  if (state === "SCORED") return { kind: "SCORED", label: "Scored" };
  if (state === "UNAVAILABLE")
    return { kind: "UNAVAILABLE", label: "Unavailable" };
  if (state === "NOT_CALCULATED")
    return { kind: "NOT_CALCULATED", label: "Not calculated" };
  if (state === "FAILED") return { kind: "FAILED", label: "Scoring failed" };
  if (state === "PENDING")
    return {
      kind: "PENDING",
      label: "Pending",
      operationId: `snapshot-${snapshotId}`,
    };
  return {
    kind: "PROCESSING",
    label: "Processing",
    operationId: `snapshot-${snapshotId}`,
  };
}

function scoreBand(
  value: number | null,
  config: AutomaticScoreStageRuleConfig = getAutomaticScoreStageRuleConfig(),
) {
  if (value === null) return null;
  if (value >= config.strongScoreThreshold)
    return { code: "HIGH_MATCH", label: "Strong match", iconLabel: "✓" };
  if (value >= config.lowScoreThreshold)
    return { code: "MEDIUM_MATCH", label: "Review needed", iconLabel: "!" };
  return { code: "LOW_MATCH", label: "Low match", iconLabel: "✕" };
}

function cleanScoreBand(
  value: number | null,
  config: AutomaticScoreStageRuleConfig = getAutomaticScoreStageRuleConfig(),
) {
  const band = scoreBand(value, config);
  return band
    ? {
        ...band,
        iconLabel:
          band.code === "HIGH_MATCH"
            ? String.fromCharCode(10003)
            : band.code === "LOW_MATCH"
              ? String.fromCharCode(10005)
              : "!",
      }
    : null;
}

function cleanFilterLabels(filters: RankingFilters) {
  return filterLabel(filters).map((filter) =>
    filter.code === "SCORE"
      ? {
          ...filter,
          label: `Score: ${filters.minScore ?? 0}-${filters.maxScore ?? 100}`,
        }
      : filter,
  );
}

function filterLabel(filters: RankingFilters) {
  const labels: Array<{ code: string; label: string; removeToken: string }> =
    [];
  if (filters.search)
    labels.push({
      code: "SEARCH",
      label: `Search: ${filters.search}`,
      removeToken: "search",
    });
  if (filters.minScore !== undefined || filters.maxScore !== undefined)
    labels.push({
      code: "SCORE",
      label: `Score: ${filters.minScore ?? 0}–${filters.maxScore ?? 100}`,
      removeToken: "score",
    });
  if (filters.skill)
    labels.push({
      code: "SKILL",
      label: `Skill: ${filters.skill}`,
      removeToken: "skill",
    });
  if (filters.minExperience !== undefined)
    labels.push({
      code: "EXPERIENCE",
      label: `Experience: ${filters.minExperience}+ years`,
      removeToken: "experience",
    });
  if (filters.stage !== "ACTIVE_PIPELINE")
    labels.push({
      code: "STAGE",
      label: `Status: ${filters.stage}`,
      removeToken: "stage",
    });
  if (filters.scoringStatus !== "ALL")
    labels.push({
      code: "SCORING_STATUS",
      label: `Scoring: ${filters.scoringStatus}`,
      removeToken: "scoringStatus",
    });
  return labels;
}

export class RankedCandidateListService {
  constructor(
    private readonly db: typeof prisma = prisma,
    private readonly authorization = new RecruiterApplicationAuthorization(),
    private readonly snapshots = new PrismaRankingSnapshotRepository(),
  ) {}

  async execute(input: {
    userId: string;
    jobId: string;
    filters: RankingFilters;
  }): Promise<RankedApplicationPage> {
    const authorized = await this.authorization.authorizeJob(
      input.userId,
      input.jobId,
    );
    if (!authorized.authorized) throw new Error("APPLICATION_UNAVAILABLE");
    const jobPostingId = authorized.jobPostingId;
    const filters = input.filters;
    const filterHash = normalizedRankingFilterHash({
      ...filters,
      cursor: undefined,
      page: undefined,
    });
    const cursor = decodeRankingCursor(filters.cursor, {
      jobId: jobPostingId,
      filterHash,
      sort: filters.sort,
      pageSize: filters.limit,
    });
    if (filters.cursor && !cursor) throw new Error("INVALID_RANKING_CURSOR");
    const rows = await this.db.jobApplication.findMany({
      where: {
        jobPostingId,
        documentDeletedAt: null,
        ...(filters.stage === "ACTIVE_PIPELINE"
          ? { withdrawalOutcome: null, stage: { not: "REJECTED" } }
          : filters.stage === "WITHDRAWN"
            ? { withdrawalOutcome: "CANDIDATE_WITHDRAWN" }
            : filters.stage !== "ALL"
              ? { withdrawalOutcome: null, stage: filters.stage }
              : {}),
        ...(filters.search
          ? {
              candidate: {
                user: {
                  OR: [
                    { name: { contains: filters.search, mode: "insensitive" } },
                    {
                      email: { contains: filters.search, mode: "insensitive" },
                    },
                  ],
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        stage: true,
        withdrawalOutcome: true,
        stageVersion: true,
        submittedAt: true,
        scoringStatus: true,
        currentScoringResultId: true,
        currentScoringResult: {
          select: {
            state: true,
            automaticScore: true,
            aiScore: true,
            finalScore: true,
            mediumThreshold: true,
            highThreshold: true,
            automaticMatch: {
              select: {
                detectedExperienceYears: true,
                skillEvidence: {
                  select: { skillLabel: true, matchState: true },
                },
              },
            },
          },
        },
        candidate: {
          select: {
            user: {
              select: {
                name: true,
                email: true,
                emailVerified: true,
                image: true,
              },
            },
          },
        },
        contactConsent: { select: { sharedAt: true, withdrawnAt: true } },
        manualPriorities: {
          where: { active: true },
          take: 1,
          orderBy: { version: "desc" },
          select: {
            id: true,
            value: true,
            reasonEncrypted: true,
            setByUserId: true,
            setAt: true,
            version: true,
            active: true,
          },
        },
      },
      take: 10_000,
    });
    const baseProjected = rows
      .filter((row) => row.candidate.user.emailVerified)
      .map((row): RankedApplicationRow => {
        const state = stateFor(row);
        const scoreConfig = automaticScoreConfigForPublishedResult({
          mediumThreshold: row.currentScoringResult?.mediumThreshold,
          highThreshold: row.currentScoringResult?.highThreshold,
        });
        const score =
          row.currentScoringResult?.finalScore === null ||
          !row.currentScoringResult
            ? null
            : Number(row.currentScoringResult.finalScore);
        const aiScore =
          row.currentScoringResult?.aiScore === null ||
          !row.currentScoringResult
            ? null
            : Number(row.currentScoringResult.aiScore);
        const priority = row.manualPriorities[0];
        return {
          applicationId: row.id,
          stage: row.stage,
          withdrawalOutcome: row.withdrawalOutcome,
          stageVersion: row.stageVersion,
          submittedAt: row.submittedAt.toISOString(),
          candidate: {
            displayName: row.candidate.user.name,
            verifiedEmail:
              row.contactConsent?.sharedAt && !row.contactConsent.withdrawnAt
                ? row.candidate.user.email
                : null,
            avatarUrl: /^https:\/\//iu.test(row.candidate.user.image ?? "")
              ? row.candidate.user.image
              : null,
          },
          experienceYears:
            row.currentScoringResult?.automaticMatch.detectedExperienceYears ===
              null || !row.currentScoringResult
              ? null
              : Number(
                  row.currentScoringResult.automaticMatch
                    .detectedExperienceYears,
                ),
          skills:
            row.currentScoringResult?.automaticMatch.skillEvidence
              .filter((skill) => skill.matchState === "FOUND")
              .map((skill) => skill.skillLabel) ?? [],
          scoring: state as RankedApplicationRow["scoring"],
          scoreSummary: {
            automatic: row.currentScoringResult
              ? Number(row.currentScoringResult.automaticScore)
              : null,
            ai: aiScore,
            final: score,
            band: cleanScoreBand(score, scoreConfig),
            aiBand: cleanScoreBand(aiScore, scoreConfig),
          },
          manuallyPrioritized: Boolean(priority),
          manualPriority: priority
            ? {
                id: priority.id,
                value: priority.value,
                label:
                  priority.value === "HIGH"
                    ? "High review priority"
                    : priority.value === "LOW"
                      ? "Low review priority"
                      : priority.value === "HOLD"
                        ? "Hold"
                        : "Normal",
                reason: priority.reasonEncrypted,
                actorUserId: priority.setByUserId,
                setAt: priority.setAt.toISOString(),
                version: priority.version,
                active: true,
              }
            : null,
          allowedActions: {
            moveToInterview:
              !row.withdrawalOutcome &&
              authorized.canMoveStages &&
              ["APPLIED", "VIEWED", "SHORTLISTED", "WAITLISTED"].includes(
                row.stage,
              )
                ? { allowed: true, label: "Move to interview" }
                : {
                    allowed: false,
                    label: "Unavailable",
                    reasonCode: "INVALID_SOURCE_STAGE",
                    reasonLabel:
                      "This stage cannot move directly to Interviewing.",
                  },
            reject:
              !row.withdrawalOutcome &&
              authorized.canReject &&
              [
                "APPLIED",
                "VIEWED",
                "SHORTLISTED",
                "INTERVIEWING",
                "OFFERED",
                "WAITLISTED",
              ].includes(row.stage)
                ? { allowed: true, label: "Reject" }
                : {
                    allowed: false,
                    label: "Unavailable",
                    reasonCode: "INVALID_SOURCE_STAGE",
                    reasonLabel: "This application is already closed.",
                  },
          },
        };
      });
    const withoutScoreFilter = baseProjected.filter((row) => {
      if (
        filters.minExperience !== undefined &&
        (row.experienceYears === null ||
          row.experienceYears < filters.minExperience)
      )
        return false;
      if (
        filters.skill &&
        !row.skills.some((skill) =>
          skill
            .toLocaleLowerCase()
            .includes(filters.skill!.toLocaleLowerCase()),
        )
      )
        return false;
      if (filters.scoringStatus !== "ALL") {
        const expected =
          filters.scoringStatus === "SCORED" ? "SCORED" : filters.scoringStatus;
        if (row.scoring.kind !== expected) return false;
      }
      return true;
    });
    const projected = withoutScoreFilter.filter((row) => {
      const score = row.scoreSummary.final;
      if (
        filters.minScore !== undefined &&
        (score === null || score < filters.minScore)
      )
        return false;
      if (
        filters.maxScore !== undefined &&
        (score === null || score > filters.maxScore)
      )
        return false;
      if (
        filters.minExperience !== undefined &&
        (row.experienceYears === null ||
          row.experienceYears < filters.minExperience)
      )
        return false;
      if (
        filters.skill &&
        !row.skills.some((skill) =>
          skill
            .toLocaleLowerCase()
            .includes(filters.skill!.toLocaleLowerCase()),
        )
      )
        return false;
      if (filters.scoringStatus !== "ALL") {
        const expected =
          filters.scoringStatus === "SCORED" ? "SCORED" : filters.scoringStatus;
        if (row.scoring.kind !== expected) return false;
      }
      return true;
    });
    projected.sort((a, b) => {
      if (filters.sort === "MANUAL_PRIORITY") {
        const priorityA = a.manualPriority
          ? priorityOrder[a.manualPriority.value]
          : 99;
        const priorityB = b.manualPriority
          ? priorityOrder[b.manualPriority.value]
          : 99;
        if (priorityA !== priorityB) return priorityA - priorityB;
      }
      const scoreA = a.scoreSummary.final ?? -1;
      const scoreB = b.scoreSummary.final ?? -1;
      if (filters.sort === "FINAL_SCORE" && scoreA !== scoreB)
        return scoreB - scoreA;
      const time = b.submittedAt.localeCompare(a.submittedAt);
      return time || b.applicationId.localeCompare(a.applicationId);
    });
    const snapshot = cursor
      ? await this.snapshots.find({
          snapshotId: cursor.snapshotId,
          jobPostingId,
          filterHash,
          sort: filters.sort,
          pageSize: filters.limit,
        })
      : await this.snapshots.create({
          jobPostingId,
          filterHash,
          filters: { ...filters, cursor: undefined, page: undefined },
          sort: filters.sort,
          pageSize: filters.limit,
          rows: projected.map((row, index) => ({
            applicationId: row.applicationId,
            rankPosition: index,
            scoreState: row.scoring.kind,
            finalScore: row.scoreSummary.final,
            submittedAt: new Date(row.submittedAt),
          })),
        });
    if (!snapshot) throw new Error("INVALID_RANKING_CURSOR");
    const byApplicationId = new Map(
      projected.map((row) => [row.applicationId, row]),
    );
    const start = cursor?.position ?? (filters.page ?? 0) * filters.limit;
    const snapshotPage = snapshot.rows.slice(start, start + filters.limit);
    const pageItems = snapshotPage.flatMap((snapshotRow) => {
      const current = byApplicationId.get(snapshotRow.applicationId);
      if (!current) return [];
      return [
        {
          ...current,
          scoreSummary: {
            ...current.scoreSummary,
            final: snapshotRow.finalScore,
            band: cleanScoreBand(
              snapshotRow.finalScore,
              getAutomaticScoreStageRuleConfig(),
            ),
          },
          scoring: snapshotStateFor(
            snapshotRow.scoreState,
            snapshot.snapshotId,
          ),
        } satisfies RankedApplicationRow,
      ];
    });
    const lastItem = pageItems.at(-1);
    const next =
      start + snapshotPage.length < snapshot.rows.length && lastItem
        ? encodeRankingCursor({
            v: 1,
            jobId: jobPostingId,
            snapshotId: snapshot.snapshotId,
            filterHash,
            sort: filters.sort,
            pageSize: filters.limit,
            position: start + snapshotPage.length,
            scoreKey: lastItem.scoreSummary.final,
            submittedAt: lastItem.submittedAt,
            applicationId: lastItem.applicationId,
          })
        : null;
    const processingExcludedCount =
      filters.minScore !== undefined || filters.maxScore !== undefined
        ? withoutScoreFilter.filter(
            (row) =>
              row.scoring.kind === "PROCESSING" ||
              row.scoring.kind === "PENDING",
          ).length
        : 0;
    const summary = {
      total: baseProjected.length,
      strong: baseProjected.filter(
        (row) => row.scoreSummary.band?.code === "HIGH_MATCH",
      ).length,
      review: baseProjected.filter(
        (row) => row.scoreSummary.band?.code === "MEDIUM_MATCH",
      ).length,
      low: baseProjected.filter(
        (row) => row.scoreSummary.band?.code === "LOW_MATCH",
      ).length,
      processing: baseProjected.filter(
        (row) =>
          row.scoring.kind === "PROCESSING" || row.scoring.kind === "PENDING",
      ).length,
    };
    const [activeRescoreCount, lastSuccessfulRescore] = await Promise.all([
      this.db.scoringOperation.count({
        where: {
          jobPostingId,
          kind: "JOB_RESCORE",
          state: { in: ["QUEUED", "RUNNING"] },
        },
      }),
      this.db.scoringOperation.findFirst({
        where: {
          jobPostingId,
          kind: "JOB_RESCORE",
          state: "COMPLETED",
          completedAt: { not: null },
        },
        orderBy: { completedAt: "desc" },
        select: { completedAt: true },
      }),
    ]);
    const rescoreInProgress = activeRescoreCount > 0;
    const page = {
      items: pageItems,
      nextCursor: next,
      rankingSnapshotId: snapshot.snapshotId,
      activeFilters: cleanFilterLabels(filters),
      processingExcludedCount,
      processingExclusionLabel: processingExcludedCount
        ? `${processingExcludedCount} candidates still processing are excluded from this score filter.`
        : null,
      defaultRejectedExclusionLabel:
        filters.stage === "ACTIVE_PIPELINE"
          ? "Rejected and withdrawn candidates are excluded from the active pipeline. Choose All, Rejected, or Withdrawn to view them."
          : null,
      rescoreInProgress,
      lastScoredAt: lastSuccessfulRescore?.completedAt?.toISOString() ?? null,
      filteredCandidates: projected.length,
      totalCandidates: baseProjected.length,
      summary,
    } satisfies RankedApplicationPage;
    return rankedApplicationPageSchema.parse(page);
  }
}
