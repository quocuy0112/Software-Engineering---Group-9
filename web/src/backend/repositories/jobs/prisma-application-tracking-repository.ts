import "server-only";
import type { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import {
  applicationStageGroup,
  applicationStageSchema,
  candidateApplicationDetailSchema,
  candidateApplicationListResponseSchema,
  type ApplicationStage,
  type ApplicationStageGroup,
  type CandidateApplicationDetail,
  type CandidateApplicationSummary,
} from "@/shared/contracts/jobs/applications";

type TrackingClient = Pick<typeof prisma, "jobApplication">;

type ListInput = {
  candidateUserId: string;
  stage?: ApplicationStage;
  group?: ApplicationStageGroup;
  cursor?: string;
  limit: number;
};

const summarySelect = {
  id: true,
  jobPostingId: true,
  stage: true,
  stageVersion: true,
  submittedAt: true,
  lastStageChangedAt: true,
  jobSnapshot: true,
  aiAnalysisConsent: true,
  aiMatchScore: true,
  scoringStatus: true,
  jobPosting: {
    select: {
      slug: true,
      title: true,
      location: true,
      employmentType: true,
      workArrangement: true,
      status: true,
      removedAt: true,
      company: {
        select: { displayName: true, logoUrl: true },
      },
    },
  },
} satisfies Prisma.JobApplicationSelect;

type SummaryRow = Prisma.JobApplicationGetPayload<{
  select: typeof summarySelect;
}>;

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function summary(row: SummaryRow): CandidateApplicationSummary {
  const snapshot = object(row.jobSnapshot);
  const stage = applicationStageSchema.parse(row.stage);
  return candidateApplicationDetailSchema
    .pick({
      applicationId: true,
      jobId: true,
      jobSlug: true,
      jobTitle: true,
      companyName: true,
      companyLogoUrl: true,
      location: true,
      employmentType: true,
      workArrangement: true,
      stage: true,
      stageVersion: true,
      submittedAt: true,
      lastStageChangedAt: true,
      jobAvailable: true,
      scoringStatus: true,
      aiMatchScore: true,
    })
    .parse({
      applicationId: row.id,
      jobId: row.jobPostingId,
      jobSlug: row.jobPosting.slug,
      jobTitle: text(snapshot.title) ?? row.jobPosting.title,
      companyName:
        text(snapshot.companyName) ?? row.jobPosting.company.displayName,
      companyLogoUrl: row.jobPosting.company.logoUrl,
      location: text(snapshot.location) ?? row.jobPosting.location,
      employmentType:
        text(snapshot.employmentType) ?? row.jobPosting.employmentType,
      workArrangement:
        text(snapshot.workArrangement) ?? row.jobPosting.workArrangement,
      stage,
      stageVersion: row.stageVersion,
      submittedAt: row.submittedAt.toISOString(),
      lastStageChangedAt: row.lastStageChangedAt.toISOString(),
      jobAvailable:
        row.jobPosting.status === "ACTIVE" && row.jobPosting.removedAt === null,
      scoringStatus: row.scoringStatus,
      aiMatchScore: row.aiMatchScore,
    });
}

function stagesForGroup(group: ApplicationStageGroup): ApplicationStage[] {
  return applicationStageSchema.options.filter(
    (stage) => applicationStageGroup[stage] === group,
  );
}

export class PrismaApplicationTrackingRepository {
  constructor(private readonly db: TrackingClient = prisma) {}

  async listCandidateApplications(input: ListInput) {
    const rows = await this.db.jobApplication.findMany({
      where: {
        candidateUserId: input.candidateUserId,
        stage: input.stage
          ? input.stage
          : input.group
            ? { in: stagesForGroup(input.group) }
            : undefined,
      },
      orderBy: [{ lastStageChangedAt: "desc" }, { id: "desc" }],
      cursor: input.cursor ? { id: input.cursor } : undefined,
      skip: input.cursor ? 1 : 0,
      take: input.limit + 1,
      select: summarySelect,
    });
    const hasNext = rows.length > input.limit;
    const visible = hasNext ? rows.slice(0, input.limit) : rows;
    return candidateApplicationListResponseSchema.parse({
      applications: visible.map(summary),
      nextCursor: hasNext ? (visible.at(-1)?.id ?? null) : null,
    });
  }

  async getCandidateApplication(
    candidateUserId: string,
    applicationId: string,
  ): Promise<CandidateApplicationDetail | null> {
    const row = await this.db.jobApplication.findFirst({
      where: { id: applicationId, candidateUserId },
      select: {
        ...summarySelect,
        coverLetter: true,
        cvSnapshot: true,
        selectedCv: { select: { displayName: true, fileName: true } },
        answers: {
          orderBy: { createdAt: "asc" },
          select: { questionSnapshot: true, answer: true },
        },
        stageEvents: {
          where: { candidateVisible: true },
          orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            fromStage: true,
            toStage: true,
            candidateVisibleReason: true,
            occurredAt: true,
            applicationVersion: true,
          },
        },
      },
    });
    if (!row) return null;

    const cvSnapshot = object(row.cvSnapshot);
    return candidateApplicationDetailSchema.parse({
      ...summary(row),
      coverLetter: row.coverLetter,
      cv: {
        displayName: text(cvSnapshot.displayName) ?? row.selectedCv.displayName,
        fileName: text(cvSnapshot.fileName) ?? row.selectedCv.fileName,
      },
      answers: row.answers.flatMap((answer) => {
        const question = text(object(answer.questionSnapshot).prompt);
        if (
          !question ||
          (typeof answer.answer !== "string" &&
            typeof answer.answer !== "boolean")
        ) {
          return [];
        }
        return [{ question, answer: answer.answer }];
      }),
      history: row.stageEvents.map((event) => ({
        eventId: event.id,
        fromStage: event.fromStage,
        toStage: event.toStage,
        candidateVisibleReason: event.candidateVisibleReason,
        occurredAt: event.occurredAt.toISOString(),
        applicationVersion: event.applicationVersion,
      })),
    });
  }

  async listAppliedJobIds(candidateUserId: string) {
    const rows = await this.db.jobApplication.findMany({
      where: { candidateUserId },
      select: { jobPostingId: true },
    });
    return rows.map((row) => row.jobPostingId);
  }
}
