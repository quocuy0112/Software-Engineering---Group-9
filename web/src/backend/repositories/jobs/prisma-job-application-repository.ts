import "server-only";
import { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import {
  ApplicationRepositoryError,
  prepareApplicationSubmission,
} from "@/backend/services/jobs/application-policy";
import { ensureCandidateCvLibrary } from "@/backend/services/profile/candidate-cv-library";
import type {
  ApplicationForm,
  ApplicationSubmission,
  ApplicationOutcome,
} from "@/shared/contracts/jobs/actions";

type CandidateApplicationForm = {
  job: {
    id: string;
    title: string;
    location: string;
    company: { displayName: string };
  };
  profileReady: boolean;
  missingProfileFields: string[];
  profileRevision: number;
  profileBasics: ApplicationForm["profileBasics"];
  contact?: ApplicationForm["contact"];
  cvs: Array<
    Omit<ApplicationForm["cvs"][number], "confirmedAt"> & { confirmedAt: Date }
  >;
  questions: ApplicationForm["questions"];
  existingApplication: ApplicationOutcome | null;
};

export type ApplicationRepositoryPort = {
  getCandidateForm(
    userId: string,
    jobId: string,
    now: Date,
  ): Promise<CandidateApplicationForm | null>;
  submit(input: {
    candidateUserId: string;
    sessionId: string;
    jobId: string;
    idempotencyKey: string;
    submissionBindingDigest: string;
    command: ApplicationSubmission;
    activeConsentVersion: string;
    occurredAt: Date;
    correlationId: string;
  }): Promise<{ application: ApplicationOutcome; created: boolean }>;
};

const outcome = (
  row: {
    id: string;
    jobPostingId: string;
    stage: string;
    submittedAt: Date;
    aiAnalysisConsent?: boolean;
    aiMatchScore?: number | null;
  },
  created: boolean,
): ApplicationOutcome => ({
  applicationId: row.id,
  jobId: row.jobPostingId,
  stage: "APPLIED",
  submittedAt: row.submittedAt.toISOString(),
  created,
  message: created
    ? "Application submitted."
    : "Your application was already submitted.",
  aiAnalysisConsent: row.aiAnalysisConsent,
  aiMatchScore: row.aiMatchScore,
});

export class PrismaJobApplicationRepository implements ApplicationRepositoryPort {
  constructor(private readonly db: typeof prisma = prisma) {}

  async getCandidateForm(userId: string, jobId: string, now: Date) {
    await ensureCandidateCvLibrary(userId, this.db);
    const [candidate, job, existingApplication] = await Promise.all([
      this.db.candidateIdentity.findFirst({
        where: { userId, user: { state: "ACTIVE" } },
        include: {
          user: { select: { name: true, email: true } },
          profile: {
            select: {
              headline: true,
              summary: true,
              location: true,
              phone: true,
              revision: true,
            },
          },
          cvs: {
            where: {
              confirmedAt: { not: null },
              archivedAt: null,
              byteSize: { gte: 1, lte: 5_000_000 },
              mimeType: {
                in: [
                  "application/pdf",
                  "application/msword",
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ],
              },
            },
            orderBy: { confirmedAt: "desc" },
            select: {
              id: true,
              displayName: true,
              fileName: true,
              mimeType: true,
              byteSize: true,
              version: true,
              confirmedAt: true,
            },
          },
        },
      }),
      this.db.jobPosting.findFirst({
        where: {
          id: jobId,
          status: "ACTIVE",
          approvedAt: { not: null },
          publishedAt: { not: null, lte: now },
          OR: [
            { applicationDeadline: null },
            { applicationDeadline: { gt: now } },
          ],
          company: { verifiedAt: { not: null } },
        },
        select: {
          id: true,
          title: true,
          location: true,
          company: { select: { displayName: true } },
          questions: {
            where: { active: true },
            orderBy: { position: "asc" },
            select: {
              id: true,
              prompt: true,
              description: true,
              kind: true,
              required: true,
              options: true,
              version: true,
            },
          },
        },
      }),
      this.db.jobApplication.findUnique({
        where: {
          candidateUserId_jobPostingId: {
            candidateUserId: userId,
            jobPostingId: jobId,
          },
        },
      }),
    ]);
    if (!candidate || !job) return null;
    const missingProfileFields = [
      !candidate.user.name.trim() ? "name" : null,
      !candidate.profile?.location?.trim() ? "location" : null,
    ].filter((field): field is string => field !== null);
    return {
      job,
      profileReady: missingProfileFields.length === 0,
      missingProfileFields,
      profileRevision: candidate.profile?.revision ?? 0,
      profileBasics: {
        headline: candidate.profile?.headline ?? null,
        summary: candidate.profile?.summary ?? null,
        phone: candidate.profile?.phone ?? null,
        location: candidate.profile?.location ?? null,
      },
      contact: {
        fullName: candidate.user.name,
        email: candidate.user.email,
        phone: candidate.profile?.phone ?? "",
      },
      cvs: candidate.cvs.flatMap((cv) => {
        if (
          !cv.confirmedAt ||
          ![
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ].includes(cv.mimeType)
        )
          return [];
        return [
          {
            ...cv,
            mimeType:
              cv.mimeType as CandidateApplicationForm["cvs"][number]["mimeType"],
            confirmedAt: cv.confirmedAt,
          },
        ];
      }),
      questions: job.questions.map((question) => ({
        ...question,
        options: Array.isArray(question.options)
          ? question.options.filter(
              (value): value is string => typeof value === "string",
            )
          : null,
      })),
      existingApplication: existingApplication
        ? outcome(existingApplication, false)
        : null,
    };
  }

  async submit(input: Parameters<ApplicationRepositoryPort["submit"]>[0]) {
    try {
      return await this.db.$transaction(
        async (tx) => {
          const sameKey = await tx.jobApplication.findUnique({
            where: {
              candidateUserId_idempotencyKey: {
                candidateUserId: input.candidateUserId,
                idempotencyKey: input.idempotencyKey,
              },
            },
          });
          if (sameKey) {
            if (
              sameKey.submissionBindingDigest !== input.submissionBindingDigest
            )
              throw new ApplicationRepositoryError("IDEMPOTENCY_KEY_REUSED");
            return { application: outcome(sameKey, false), created: false };
          }
          const duplicate = await tx.jobApplication.findUnique({
            where: {
              candidateUserId_jobPostingId: {
                candidateUserId: input.candidateUserId,
                jobPostingId: input.jobId,
              },
            },
          });
          if (duplicate)
            return { application: outcome(duplicate, false), created: false };

          const candidate = await tx.candidateIdentity.findFirst({
            where: { userId: input.candidateUserId, user: { state: "ACTIVE" } },
            include: {
              user: { select: { name: true } },
              profile: {
                include: {
                  skills: {
                    orderBy: { position: "asc" },
                    include: { skill: true },
                  },
                  experiences: { orderBy: { position: "asc" } },
                  education: { orderBy: { position: "asc" } },
                },
              },
            },
          });
          const cv = await tx.candidateCv.findUnique({
            where: { id: input.command.cvId },
          });
          const job = await tx.jobPosting.findFirst({
            where: {
              id: input.jobId,
              status: "ACTIVE",
              approvedAt: { not: null },
              publishedAt: { not: null, lte: input.occurredAt },
              OR: [
                { applicationDeadline: null },
                { applicationDeadline: { gt: input.occurredAt } },
              ],
              company: { verifiedAt: { not: null } },
            },
            include: {
              company: { select: { id: true, displayName: true } },
              skills: {
                where: { required: true },
                orderBy: { position: "asc" },
                select: { displayName: true },
              },
              questions: {
                where: { active: true },
                orderBy: { position: "asc" },
              },
            },
          });
          if (!candidate?.profile)
            throw new ApplicationRepositoryError(
              "APPLICATION_PROFILE_INCOMPLETE",
            );
          if (!job)
            throw new ApplicationRepositoryError(
              "JOB_NO_LONGER_ACCEPTING_APPLICATIONS",
            );
          const prepared = prepareApplicationSubmission(
            {
              candidate: {
                userId: candidate.userId,
                name: candidate.user.name,
                headline: candidate.profile.headline,
                location: candidate.profile.location,
                skills: candidate.profile.skills.map((item) => ({
                  id: item.skillId,
                  label: item.displayName,
                })),
                experience: candidate.profile.experiences.map((item) => ({
                  title: item.title,
                  company: item.company,
                  startDate: item.startDate,
                  endDate: item.endDate,
                })),
                education: candidate.profile.education.map((item) => ({
                  institution: item.institution,
                  degree: item.degree,
                  field: item.field,
                })),
              },
              cv,
              job: {
                id: job.id,
                version: job.version,
                title: job.title,
                companyId: job.company.id,
                companyName: job.company.displayName,
                location: job.location,
                employmentType: job.employmentType,
                experienceLevel: job.experienceLevel,
                workArrangement: job.workArrangement,
                requiredSkills: job.skills.map((skill) => skill.displayName),
              },
              questions: job.questions.map((question) => ({
                id: question.id,
                prompt: question.prompt,
                description: question.description,
                kind: question.kind,
                required: question.required,
                options: Array.isArray(question.options)
                  ? question.options.filter(
                      (value): value is string => typeof value === "string",
                    )
                  : null,
                version: question.version,
              })),
            },
            input.command,
            input.activeConsentVersion,
            input.occurredAt,
          );
          const cvFileRef =
            input.command.cvFileRef &&
            input.command.cvFileRef !== input.command.cvId
              ? input.command.cvFileRef
              : prepared.cvSnapshot.storageKey;
          const created = await tx.jobApplication.create({
            data: {
              candidateUserId: input.candidateUserId,
              jobPostingId: input.jobId,
              selectedCvId: input.command.cvId,
              cvFileRef,
              contactSnapshot: input.command.contactSnapshot
                ? (input.command.contactSnapshot as Prisma.InputJsonValue)
                : undefined,
              aiAnalysisConsent: input.command.aiAnalysisConsent ?? false,
              aiMatchScore: input.command.aiAnalysisConsent ? 82 : null,
              scoringStatus: input.command.aiAnalysisConsent
                ? "COMPLETED"
                : "NOT_REQUESTED",
              stage: "APPLIED",
              coverLetter: prepared.coverLetter,
              profileSnapshot:
                prepared.profileSnapshot as Prisma.InputJsonValue,
              cvSnapshot: prepared.cvSnapshot as Prisma.InputJsonValue,
              jobSnapshot: prepared.jobSnapshot as Prisma.InputJsonValue,
              consentVersion: input.command.consentVersion,
              consentedAt: prepared.consentedAt,
              idempotencyKey: input.idempotencyKey,
              submissionBindingDigest: input.submissionBindingDigest,
              submittedAt: input.occurredAt,
              stageVersion: 1,
              lastStageChangedAt: input.occurredAt,
              answers: {
                create: prepared.answers.map((answer) => ({
                  questionId: answer.questionId,
                  questionSnapshot:
                    answer.questionSnapshot as Prisma.InputJsonValue,
                  answer: answer.answer as Prisma.InputJsonValue,
                })),
              },
              stageEvents: {
                create: {
                  fromStage: null,
                  toStage: "APPLIED",
                  actorUserId: input.candidateUserId,
                  actorType: "CANDIDATE",
                  candidateVisible: true,
                  occurredAt: input.occurredAt,
                  applicationVersion: 1,
                  metadata: { v: 1, source: "application-submission" },
                },
              },
              notificationWork: {
                create: [
                  {
                    audience: "CANDIDATE",
                    kind: "APPLICATION_SUBMITTED",
                    targetReference: input.candidateUserId,
                    payloadRef: {
                      v: 1,
                      jobId: input.jobId,
                      templateVersion: "1",
                    },
                    idempotencyKey: `application:${input.candidateUserId}:${input.jobId}:candidate`,
                  },
                  {
                    audience: "COMPANY",
                    kind: "APPLICATION_RECEIVED",
                    targetReference: job.company.id,
                    payloadRef: {
                      v: 1,
                      jobId: input.jobId,
                      templateVersion: "1",
                    },
                    idempotencyKey: `application:${input.candidateUserId}:${input.jobId}:company`,
                  },
                ],
              },
            },
          });
          await new PrismaAuditRepository(tx).append({
            occurredAt: input.occurredAt,
            actorType: "user",
            actorUserId: input.candidateUserId,
            actorSessionId: input.sessionId,
            action: "job.application.submitted",
            targetType: "job_application",
            targetId: created.id,
            result: "SUCCESS",
            correlationId: input.correlationId,
            context: { stage: "APPLIED", notificationWorkCount: 2 },
          });
          return { application: outcome(created, true), created: true };
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      if (error instanceof ApplicationRepositoryError) throw error;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existing = await this.db.jobApplication.findUnique({
          where: {
            candidateUserId_jobPostingId: {
              candidateUserId: input.candidateUserId,
              jobPostingId: input.jobId,
            },
          },
        });
        if (existing)
          return { application: outcome(existing, false), created: false };
      }
      throw error;
    }
  }
}
