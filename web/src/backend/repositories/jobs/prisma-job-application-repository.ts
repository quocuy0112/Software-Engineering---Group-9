import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/backend/generated/prisma/client";
import {
  ApplicationArtifactPromotionState,
  ApplicationDocumentKind,
} from "@/backend/generated/prisma/enums";
import { prisma } from "@/backend/database/prisma";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import {
  ApplicationRepositoryError,
  type DirectApplicationCv,
  prepareApplicationSubmission,
} from "@/backend/services/jobs/application-policy";
import { DIRECT_APPLICATION_CV_ID } from "@/shared/contracts/jobs/actions";
import { ensureCandidateCvLibrary } from "@/backend/services/profile/candidate-cv-library";
import type {
  ApplicationForm,
  ApplicationSubmission,
  ApplicationOutcome,
} from "@/shared/contracts/jobs/actions";
import { createInAppNotification } from "@/backend/notifications/notification-service";
import { NotificationRecipientPolicy } from "@/backend/notifications/notification-recipient-policy";
import { createApplicationDocumentStorage } from "@/backend/applications/storage/factory";
import type { ApplicationDocumentStoragePort } from "@/backend/applications/storage/application-document-storage";
import { promoteCandidateCvForApplication } from "@/backend/services/profile/promote-candidate-cv-for-application";
import { createCvWorkerStorage } from "@/backend/cv/workers/cv-worker-resources";

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
    directCv?: DirectApplicationCv;
    directCoverLetter?: DirectApplicationCv;
    activeConsentVersion: string;
    occurredAt: Date;
    correlationId: string;
    draftId?: string;
    expectedDraftRevision?: number;
  }): Promise<{ application: ApplicationOutcome; created: boolean }>;
};

const outcome = (
  row: {
    id: string;
    jobPostingId: string;
    stage: string;
    submittedAt: Date;
    stageVersion?: number;
    aiAnalysisConsent?: boolean;
    aiMatchScore?: number | null;
  },
  created: boolean,
): ApplicationOutcome => ({
  applicationId: row.id,
  jobId: row.jobPostingId,
  stage: "APPLIED",
  stageVersion: row.stageVersion ?? 1,
  submittedAt: row.submittedAt.toISOString(),
  created,
  message: created
    ? "Application submitted."
    : "Your application was already submitted.",
  aiAnalysisConsent: row.aiAnalysisConsent,
  aiMatchScore: row.aiMatchScore,
});

export class PrismaJobApplicationRepository implements ApplicationRepositoryPort {
  constructor(
    private readonly db: typeof prisma = prisma,
    private readonly applicationStorage?: ApplicationDocumentStoragePort,
  ) {}

  private documentStorage() {
    return this.applicationStorage ?? createApplicationDocumentStorage();
  }

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
    await ensureCandidateCvLibrary(input.candidateUserId, this.db);
    let promotedStorage: ApplicationDocumentStoragePort | null = null;
    let promotedApplicationDocument:
      | {
          promotionId: string;
          storageKey: string;
          fileName: string;
          mediaType: string;
          byteLength: number;
          checksumSha256: string;
          sourceCvId: string;
          sourceCvVersion: number;
        }
      | undefined;
    let promotedCoverLetterDocument:
      | {
          promotionId: string;
          storageKey: string;
          fileName: string;
          mediaType: string;
          byteLength: number;
          checksumSha256: string;
        }
      | undefined;
    try {
      const existingByKey = await this.db.jobApplication.findUnique({
        where: {
          candidateUserId_idempotencyKey: {
            candidateUserId: input.candidateUserId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (existingByKey) {
        if (
          existingByKey.submissionBindingDigest !==
          input.submissionBindingDigest
        ) {
          throw new ApplicationRepositoryError("IDEMPOTENCY_KEY_REUSED");
        }
        return { application: outcome(existingByKey, false), created: false };
      }
      const existingDuplicate = await this.db.jobApplication.findUnique({
        where: {
          candidateUserId_jobPostingId: {
            candidateUserId: input.candidateUserId,
            jobPostingId: input.jobId,
          },
        },
      });
      if (existingDuplicate) {
        return {
          application: outcome(existingDuplicate, false),
          created: false,
        };
      }
      const sourceCv = input.directCv
        ? null
        : await this.db.candidateCv.findUnique({
            where: { id: input.command.cvId },
            select: {
              id: true,
              candidateUserId: true,
              fileName: true,
              mimeType: true,
              byteSize: true,
              storageKey: true,
              checksumSha256: true,
              version: true,
              confirmedAt: true,
              archivedAt: true,
            },
          });
      if (
        !input.directCv &&
        sourceCv?.candidateUserId === input.candidateUserId
      ) {
        promotedStorage = this.documentStorage();
        let stored: Awaited<ReturnType<ApplicationDocumentStoragePort["put"]>>;
        if (sourceCv.storageKey.startsWith("candidate-cv-")) {
          const promotion = await promoteCandidateCvForApplication(
            sourceCv,
            this.documentStorage(),
            this.db,
          );
          if (!promotion) {
            throw new ApplicationRepositoryError("APPLICATION_CV_INELIGIBLE");
          }
          promotedStorage = promotion.destination;
          stored = promotion.stored;
        } else {
          const sourceStorage = createCvWorkerStorage();
          await promotedStorage.assertReady();
          await sourceStorage.assertReady();
          stored = await promotedStorage.put({
            expectedBytes: sourceCv.byteSize,
            source: sourceStorage.open(sourceCv.storageKey, sourceCv.byteSize),
          });
        }
        promotedApplicationDocument = {
          promotionId: randomUUID(),
          storageKey: stored.locator,
          fileName: sourceCv.fileName,
          mediaType: sourceCv.mimeType,
          byteLength: stored.bytes,
          checksumSha256: sourceCv.checksumSha256,
          sourceCvId: sourceCv.id,
          sourceCvVersion: sourceCv.version,
        };
      } else if (input.directCv) {
        promotedApplicationDocument = {
          promotionId: randomUUID(),
          storageKey: input.directCv.storageKey,
          fileName: input.directCv.fileName,
          mediaType: input.directCv.mimeType,
          byteLength: input.directCv.byteSize,
          checksumSha256: input.directCv.checksumSha256,
          sourceCvId: input.directCv.id,
          sourceCvVersion: 1,
        };
      }
      if (input.directCoverLetter) {
        promotedCoverLetterDocument = {
          promotionId: randomUUID(),
          storageKey: input.directCoverLetter.storageKey,
          fileName: input.directCoverLetter.fileName,
          mediaType: input.directCoverLetter.mimeType,
          byteLength: input.directCoverLetter.byteSize,
          checksumSha256: input.directCoverLetter.checksumSha256,
        };
      }
      const result = await this.db.$transaction(
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

          if (input.draftId) {
            const draft = await tx.candidateApplicationDraft.findFirst({
              where: {
                id: input.draftId,
                candidateUserId: input.candidateUserId,
                jobPostingId: input.jobId,
                expiresAt: { gt: input.occurredAt },
              },
              select: {
                id: true,
                revision: true,
                confirmationAccepted: true,
              },
            });
            if (
              !draft ||
              draft.revision !== input.expectedDraftRevision ||
              !draft.confirmationAccepted
            ) {
              throw new ApplicationRepositoryError(
                !draft || draft.revision !== input.expectedDraftRevision
                  ? "APPLICATION_DRAFT_CONFLICT"
                  : "APPLICATION_CONFIRMATION_REQUIRED",
              );
            }
          }

          const candidate = await tx.candidateIdentity.findFirst({
            where: { userId: input.candidateUserId, user: { state: "ACTIVE" } },
            include: {
              user: { select: { name: true, email: true } },
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
          if (
            input.directCv &&
            input.command.cvId !== DIRECT_APPLICATION_CV_ID
          ) {
            throw new ApplicationRepositoryError("APPLICATION_CV_INELIGIBLE");
          }
          const cv = input.directCv
            ? await tx.candidateCv.create({
                data: {
                  id: input.directCv.id,
                  candidateUserId: input.candidateUserId,
                  displayName: input.directCv.displayName,
                  fileName: input.directCv.fileName,
                  mimeType: input.directCv.mimeType,
                  byteSize: input.directCv.byteSize,
                  storageKey: input.directCv.storageKey,
                  checksumSha256: input.directCv.checksumSha256,
                  version: 1,
                  confirmedAt: input.occurredAt,
                },
              })
            : await tx.candidateCv.findUnique({
                where: { id: input.command.cvId },
              });
          if (!cv || cv.candidateUserId !== input.candidateUserId) {
            throw new ApplicationRepositoryError("APPLICATION_CV_INELIGIBLE");
          }
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
              reviewAggregate: { select: { jobId: true } },
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
                email: candidate.user.email,
                headline: candidate.profile.headline,
                summary: candidate.profile.summary,
                phone: candidate.profile.phone,
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
              questions: input.draftId
                ? []
                : job.questions.map((question) => ({
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
            input.directCoverLetter
              ? { ...input.command, coverLetter: null }
              : input.command,
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
              // Group 1 does not calculate or infer a score. Later scoring
              // groups own the versioned evaluation records.
              aiMatchScore: null,
              scoringStatus: input.command.aiAnalysisConsent
                ? "PENDING"
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
              submissionMessage: input.command.message ?? null,
              legacyDocumentState: "CURRENT",
              applicationDocuments: {
                create: [
                  {
                    kind: ApplicationDocumentKind.CV,
                    storagePurposeVersion: "application-document-v1",
                    storageKeyEncrypted:
                      promotedApplicationDocument?.storageKey ??
                      prepared.cvSnapshot.storageKey,
                    originalFilenameEncrypted:
                      promotedApplicationDocument?.fileName ??
                      prepared.cvSnapshot.fileName,
                    mediaType:
                      promotedApplicationDocument?.mediaType ??
                      prepared.cvSnapshot.mimeType,
                    byteLength:
                      promotedApplicationDocument?.byteLength ??
                      prepared.cvSnapshot.byteSize,
                    contentDigestHmac:
                      promotedApplicationDocument?.checksumSha256 ??
                      prepared.cvSnapshot.checksumSha256,
                    sourceCandidateCvId:
                      promotedApplicationDocument?.sourceCvId ?? cv.id,
                    sourceCandidateCvVersion:
                      promotedApplicationDocument?.sourceCvVersion ??
                      cv.version,
                    safetyAssessmentId: `application-safety-${cv.id}`,
                    committedAt: input.occurredAt,
                  },
                  ...(promotedCoverLetterDocument
                    ? [
                        {
                          kind: ApplicationDocumentKind.COVER_LETTER,
                          storagePurposeVersion: "application-document-v1",
                          storageKeyEncrypted:
                            promotedCoverLetterDocument.storageKey,
                          originalFilenameEncrypted:
                            promotedCoverLetterDocument.fileName,
                          mediaType: promotedCoverLetterDocument.mediaType,
                          byteLength: promotedCoverLetterDocument.byteLength,
                          contentDigestHmac:
                            promotedCoverLetterDocument.checksumSha256,
                          safetyAssessmentId: `application-safety-${promotedCoverLetterDocument.promotionId}`,
                          committedAt: input.occurredAt,
                        },
                      ]
                    : []),
                ],
              },
              ...(prepared.coverLetter
                ? {
                    coverLetterText: {
                      create: {
                        textEncrypted: prepared.coverLetter,
                        characterCount: Array.from(prepared.coverLetter).length,
                      },
                    },
                  }
                : {}),
              ...(promotedApplicationDocument
                ? {
                    artifactPromotions: {
                      create: [
                        {
                          id: promotedApplicationDocument.promotionId,
                          candidate: { connect: { id: input.candidateUserId } },
                          jobPosting: { connect: { id: input.jobId } },
                          kind: ApplicationDocumentKind.CV,
                          storagePurposeVersion: "application-document-v1",
                          storageKeyEncrypted:
                            promotedApplicationDocument.storageKey,
                          state: ApplicationArtifactPromotionState.COMMITTED,
                          orphanDeleteAfter: new Date(
                            input.occurredAt.getTime() + 24 * 60 * 60 * 1000,
                          ),
                        },
                        ...(promotedCoverLetterDocument
                          ? [
                              {
                                id: promotedCoverLetterDocument.promotionId,
                                candidate: {
                                  connect: { id: input.candidateUserId },
                                },
                                jobPosting: { connect: { id: input.jobId } },
                                kind: ApplicationDocumentKind.COVER_LETTER,
                                storagePurposeVersion:
                                  "application-document-v1",
                                storageKeyEncrypted:
                                  promotedCoverLetterDocument.storageKey,
                                state:
                                  ApplicationArtifactPromotionState.COMMITTED,
                                orphanDeleteAfter: new Date(
                                  input.occurredAt.getTime() +
                                    24 * 60 * 60 * 1000,
                                ),
                              },
                            ]
                          : []),
                      ],
                    },
                  }
                : {}),
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
            },
          });
          if (input.command.aiAnalysisConsent) {
            const scoringOperation = await tx.scoringOperation.create({
              data: {
                kind: "INITIAL",
                jobPostingId: input.jobId,
                jobApplicationId: created.id,
                requestedByUserId: input.candidateUserId,
                requestedAt: input.occurredAt,
                confirmationIntent: true,
                idempotencyKey: `initial-scoring:${created.id}`,
                targetJobDescriptionVersionId: `job-${job.id}-v${job.version}`,
                targetScoringConfigVersionId: "hybrid-60-40-v1",
                totalCount: 1,
              },
            });
            await tx.scoringWorkItem.create({
              data: {
                operationId: scoringOperation.id,
                jobApplicationId: created.id,
              },
            });
            await tx.jobApplication.update({
              where: { id: created.id },
              data: { scoringStatus: "PROCESSING" },
            });
          }
          await tx.applicationIntake.create({
            data: {
              applicationId: created.id,
              state: "RECEIVED",
              progressPercent: 0,
              receivedAt: input.occurredAt,
              version: 1,
            },
          });
          const accountPreferences = await tx.accountPreferences.findUnique({
            where: { userId: input.candidateUserId },
            select: { applicationUpdatesEmail: true },
          });
          await tx.applicationNotificationPreference.create({
            data: {
              applicationId: created.id,
              emailEnabled: accountPreferences?.applicationUpdatesEmail ?? true,
              inAppEnabled: true,
              version: 1,
            },
          });
          await tx.applicationPublicUpdate.create({
            data: {
              applicationId: created.id,
              kind: "SUBMITTED",
              publicStage: "APPLICATION_SUBMITTED",
              title: "Application submitted",
              effectiveAt: input.occurredAt,
              deduplicationKey: `application:${created.id}:public:submitted`,
              sourceEventReference: null,
            },
          });
          await tx.recruitmentNotificationWork.create({
            data: {
              applicationId: created.id,
              audience: "CANDIDATE",
              kind: "APPLICATION_SUBMITTED",
              targetReference: input.candidateUserId,
              payloadRef: {
                v: 1,
                event: "APPLICATION_SUBMITTED",
                applicationId: created.id,
                jobTitle: job.title,
                companyName: job.company.displayName,
              },
              idempotencyKey: `application:${created.id}:receipt`,
            },
          });
          await createInAppNotification(tx, {
            recipientUserId: input.candidateUserId,
            kind: "APPLICATION_SUBMITTED",
            deduplicationKey: `application:${input.candidateUserId}:${input.jobId}:candidate`,
            correlationId: input.correlationId,
            occurredAt: input.occurredAt,
            contextType: "APPLICATION",
            contextId: created.id,
          });
          const companyRecipients = await new NotificationRecipientPolicy(
            tx,
          ).activeCompanyRecipients(job.company.id);
          for (const recipientUserId of companyRecipients) {
            await createInAppNotification(tx, {
              recipientUserId,
              kind: "APPLICATION_RECEIVED",
              deduplicationKey: `application:${input.candidateUserId}:${input.jobId}:company:${recipientUserId}`,
              correlationId: input.correlationId,
              occurredAt: input.occurredAt,
              contextType: "APPLICATION",
              contextId: created.id,
              variables: {
                recipientRole: "RECRUITER",
                // Candidate applications use the public JobPosting ID. The
                // recruiter workspace uses the catalogue/review job ID, so
                // persist the latter when this posting has a review mapping.
                jobId: job.reviewAggregate?.jobId ?? input.jobId,
              },
            });
          }
          if (input.directCv) {
            await tx.candidateCv.update({
              where: { id: input.directCv.id },
              data: { archivedAt: input.occurredAt },
            });
          }
          if (input.draftId) {
            await tx.candidateApplicationDraft.deleteMany({
              where: {
                id: input.draftId,
                candidateUserId: input.candidateUserId,
                jobPostingId: input.jobId,
                revision: input.expectedDraftRevision,
              },
            });
          }
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
            context: {
              stage: "APPLIED",
              notificationWorkCount: companyRecipients.length + 2,
            },
          });
          return { application: outcome(created, true), created: true };
        },
        { isolationLevel: "Serializable" },
      );
      if (!result.created && promotedApplicationDocument && promotedStorage) {
        await promotedStorage
          .delete(promotedApplicationDocument.storageKey)
          .catch(() => undefined);
      }
      if (!result.created && promotedCoverLetterDocument && promotedStorage) {
        await promotedStorage
          .delete(promotedCoverLetterDocument.storageKey)
          .catch(() => undefined);
      }
      return result;
    } catch (error) {
      if (promotedApplicationDocument && promotedStorage) {
        await promotedStorage
          .delete(promotedApplicationDocument.storageKey)
          .catch(() => undefined);
      }
      if (promotedCoverLetterDocument && promotedStorage) {
        await promotedStorage
          .delete(promotedCoverLetterDocument.storageKey)
          .catch(() => undefined);
      }
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
