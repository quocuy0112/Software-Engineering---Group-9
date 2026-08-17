import "server-only";

import { prisma } from "@/backend/database/prisma";
import { applicationStageSchema, type ApplicationStage } from "@/shared/contracts/jobs/applications";
import {
  applicationFileDescriptorSchema,
  applicationIntakeSchema,
  applicationPublicUpdateSchema,
  applicationTrackerSchema,
  candidateApplicationListResponseSchema,
  candidateApplicationSummarySchema,
  notificationPreferenceSchema,
  publicOutcomeForCanonicalStage,
  publicStageForCanonicalStage,
  type ApplicationIntake,
  type ApplicationPublicUpdate,
  type ApplicationTracker,
  type CandidateApplicationSummary,
} from "@/shared/contracts/candidate-applications";
import type { CandidateActor } from "@/backend/services/jobs/job-types";
import { CandidateApplicationError } from "./candidate-application-errors";
import {
  PrismaCandidateApplicationRepository,
  type CandidateApplicationTrackerRow,
} from "@/backend/repositories/candidate-applications/prisma-candidate-application-repository";

const withdrawableStages = new Set<ApplicationStage>([
  "APPLIED",
  "VIEWED",
  "SHORTLISTED",
  "WAITLISTED",
]);

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function publicUpdateTitle(kind: string) {
  switch (kind) {
    case "SUBMITTED":
      return "Application submitted";
    case "UNDER_REVIEW":
      return "Application under review";
    case "INTERVIEW":
      return "Interview stage reached";
    case "OUTCOME":
      return "Application outcome updated";
    case "WITHDRAWN":
      return "Application withdrawn";
    case "TECHNICAL_UPDATE":
      return "Application file check updated";
    default:
      return null;
  }
}

function safeFilename(value: string | null | undefined, fallback: string) {
  const normalized = value
    ?.replace(/[\\/\r\n]/gu, "_")
    .replace(/[^\p{L}\p{N}._ -]/gu, "_")
    .trim();
  if (!normalized || /^(?:application|candidate|imported)-cv-/iu.test(normalized)) {
    return fallback;
  }
  return normalized.slice(0, 255);
}

function fileFromCv(row: CandidateApplicationTrackerRow) {
  const snapshot = object(row.cvSnapshot);
  const source = row.selectedCv;
  const mimeType = text(snapshot.mimeType) ?? source.mimeType;
  const descriptor = applicationFileDescriptorSchema.safeParse({
    versionId: text(snapshot.cvId) ?? source.id,
    displayName: text(snapshot.displayName) ?? source.displayName,
    fileName: safeFilename(
      text(snapshot.fileName) ?? source.fileName,
      "candidate-cv.pdf",
    ),
    mimeType,
    byteSize:
      typeof snapshot.byteSize === "number" ? snapshot.byteSize : source.byteSize,
    version:
      typeof snapshot.cvVersion === "number" ? snapshot.cvVersion : source.version,
    parseStatus: "READY",
    confirmedAt: source.confirmedAt?.toISOString(),
  });
  if (!descriptor.success) {
    throw new CandidateApplicationError(
      503,
      "APPLICATION_PROJECTION_UNAVAILABLE",
      "This application is temporarily unavailable.",
    );
  }
  return descriptor.data;
}

function fileFromDocument(document: CandidateApplicationTrackerRow["applicationDocuments"][number]) {
  const fallback = document.kind === "COVER_LETTER" ? "cover-letter.pdf" : "candidate-cv.pdf";
  const parsed = applicationFileDescriptorSchema.safeParse({
    versionId: document.id,
    displayName: safeFilename(document.originalFilenameEncrypted, fallback),
    fileName: safeFilename(document.originalFilenameEncrypted, fallback),
    mimeType: document.mediaType,
    byteSize: document.byteLength,
    parseStatus: "NOT_APPLICABLE",
  });
  return parsed.success ? parsed.data : null;
}

function intake(row: CandidateApplicationTrackerRow): ApplicationIntake {
  const current = row.intake ?? {
    state: "SENT_TO_RECRUITER" as const,
    progressPercent: 100,
    receivedAt: row.submittedAt,
    checkingStartedAt: row.submittedAt,
    sentAt: row.submittedAt,
    failureCode: null,
    updatedAt: row.submittedAt,
  };
  const state = current.state;
  const steps = [
    {
      code: "APPLICATION_RECEIVED" as const,
      status: "COMPLETE" as const,
      timestamp: current.receivedAt.toISOString(),
    },
    {
      code: "CHECKING_FILES" as const,
      status:
        state === "ATTENTION_REQUIRED"
          ? ("ATTENTION_REQUIRED" as const)
          : state === "RECEIVED"
            ? ("PENDING" as const)
            : state === "SENT_TO_RECRUITER"
              ? ("COMPLETE" as const)
              : ("ACTIVE" as const),
      timestamp:
        current.checkingStartedAt?.toISOString() ?? null,
    },
    {
      code: "SENT_TO_RECRUITER" as const,
      status:
        state === "SENT_TO_RECRUITER" ? ("COMPLETE" as const) : ("PENDING" as const),
      timestamp: current.sentAt?.toISOString() ?? null,
    },
  ];
  return applicationIntakeSchema.parse({
    state,
    progressPercent: current.progressPercent,
    steps,
    failureCode: current.failureCode,
    updatedAt: current.updatedAt.toISOString(),
  });
}

function stageUpdate(
  event: CandidateApplicationTrackerRow["stageEvents"][number],
): ApplicationPublicUpdate | null {
  const stage = applicationStageSchema.parse(event.toStage);
  if (stage === "APPLIED") return null;
  const publicStage = publicStageForCanonicalStage(stage);
  const kind =
    publicStage === "UNDER_REVIEW"
      ? "UNDER_REVIEW"
      : publicStage === "INTERVIEW"
        ? "INTERVIEW"
        : "OUTCOME";
  const title =
    publicStage === "UNDER_REVIEW"
      ? "Application under review"
      : publicStage === "INTERVIEW"
        ? "Interview stage reached"
        : "Application outcome updated";
  return applicationPublicUpdateSchema.parse({
    id: event.id,
    kind,
    publicStage,
    publicOutcome: publicOutcomeForCanonicalStage(stage),
    title,
    occurredAt: event.occurredAt.toISOString(),
  });
}

function publicUpdates(row: CandidateApplicationTrackerRow) {
  const updates = row.publicUpdates.flatMap((update) => {
    const title = publicUpdateTitle(update.kind);
    if (!title) return [];
    return [
      applicationPublicUpdateSchema.parse({
        id: update.id,
        kind: update.kind,
        publicStage: update.publicStage,
        publicOutcome: update.publicOutcome,
        title,
        occurredAt: update.effectiveAt.toISOString(),
      }),
    ];
  });
  const known = new Set(updates.map((update) => update.id));
  const knownEventReferences = new Set(
    row.publicUpdates
      .map((update) => update.sourceEventReference)
      .filter((reference): reference is string => Boolean(reference)),
  );
  for (const event of row.stageEvents) {
    const update = stageUpdate(event);
    if (
      update &&
      !known.has(update.id) &&
      !knownEventReferences.has(event.id)
    )
      updates.push(update);
  }
  if (row.withdrawalOutcome && row.withdrawnAt) {
    const id = `withdrawal:${row.id}`;
    if (!known.has(id)) {
      updates.push(
        applicationPublicUpdateSchema.parse({
          id,
          kind: "WITHDRAWN",
          publicStage: publicStageForCanonicalStage(
            applicationStageSchema.parse(row.stage),
          ),
          publicOutcome: "WITHDRAWN",
          title: "Application withdrawn",
          occurredAt: row.withdrawnAt.toISOString(),
        }),
      );
    }
  }
  return updates.sort((left, right) =>
    left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id),
  ).slice(-500);
}

function tracker(row: CandidateApplicationTrackerRow): ApplicationTracker {
  const canonicalStage = applicationStageSchema.parse(row.stage);
  const documents = row.applicationDocuments
    .filter(
      (document) => document.kind !== "CV" && document.committedAt !== null,
    )
    .map(fileFromDocument)
    .filter((file): file is NonNullable<typeof file> => Boolean(file));
  const cv = documents.find((file) => file.versionId === row.selectedCv.id) ?? fileFromCv(row);
  const files = [cv, ...documents.filter((file) => file.versionId !== cv.versionId)];
  const preference = row.notificationPreference
    ? notificationPreferenceSchema.parse({
        emailEnabled: row.notificationPreference.emailEnabled,
        inAppEnabled: row.notificationPreference.inAppEnabled,
        version: row.notificationPreference.version,
        updatedAt: row.notificationPreference.updatedAt.toISOString(),
      })
    : notificationPreferenceSchema.parse({
        emailEnabled: row.candidate.user.preferences?.applicationUpdatesEmail ?? true,
        inAppEnabled: true,
        version: 1,
        updatedAt: row.submittedAt.toISOString(),
      });
  const publicOutcome =
    row.withdrawalOutcome === "CANDIDATE_WITHDRAWN"
      ? "WITHDRAWN"
      : publicOutcomeForCanonicalStage(canonicalStage);
  return applicationTrackerSchema.parse({
    applicationId: row.id,
    job: {
      jobId: row.jobPostingId,
      slug: row.jobPosting.slug,
      title: text(object(row.jobSnapshot).title) ?? row.jobPosting.title,
      companyName:
        text(object(row.jobSnapshot).companyName) ?? row.jobPosting.company.displayName,
      companyLogoUrl: row.jobPosting.company.logoUrl,
      location: text(object(row.jobSnapshot).location) ?? row.jobPosting.location,
      jobAvailable:
        row.jobPosting.status === "ACTIVE" && row.jobPosting.removedAt === null,
    },
    publicStage: publicStageForCanonicalStage(canonicalStage),
    publicOutcome,
    canonicalStage,
    stageVersion: row.stageVersion,
    submittedAt: row.submittedAt.toISOString(),
    lastUpdatedAt: new Date(
      Math.max(row.lastStageChangedAt.getTime(), row.withdrawnAt?.getTime() ?? 0),
    ).toISOString(),
    intake: intake(row),
    updates: publicUpdates(row),
    files: files.slice(0, 2),
    notificationPreference: preference,
    canWithdraw: withdrawableStages.has(canonicalStage) && !row.withdrawalOutcome,
  });
}

function summary(row: CandidateApplicationTrackerRow): CandidateApplicationSummary {
  const result = tracker(row);
  return candidateApplicationSummarySchema.parse({
    applicationId: result.applicationId,
    jobId: result.job.jobId,
    jobSlug: result.job.slug,
    jobTitle: result.job.title,
    companyName: result.job.companyName,
    companyLogoUrl: result.job.companyLogoUrl,
    location: result.job.location,
    publicStage: result.publicStage,
    publicOutcome: result.publicOutcome,
    canonicalStage: result.canonicalStage,
    stageVersion: result.stageVersion,
    submittedAt: result.submittedAt,
    lastUpdatedAt: result.lastUpdatedAt,
    jobAvailable: result.job.jobAvailable,
  });
}

export class CandidateApplicationTrackingService {
  constructor(
    private readonly repository = new PrismaCandidateApplicationRepository(),
  ) {}

  async get(actor: CandidateActor, applicationId: string) {
    const row = await this.repository.getTracker(actor.userId, applicationId);
    if (!row) {
      throw new CandidateApplicationError(
        404,
        "APPLICATION_UNAVAILABLE",
        "This application is unavailable.",
      );
    }
    return tracker(row);
  }

  async list(
    actor: CandidateActor,
    input: { limit?: number; cursor?: string } = {},
  ) {
    const limit = Math.min(Math.max(input.limit ?? 24, 1), 100);
    const rows = await this.repository.list(actor.userId, limit, input.cursor);
    const hasNext = rows.length > limit;
    const visible = hasNext ? rows.slice(0, limit) : rows;
    return candidateApplicationListResponseSchema.parse({
      applications: visible.map(summary),
      nextCursor: hasNext ? visible.at(-1)?.id ?? null : null,
    });
  }

  async updatePreference(
    actor: CandidateActor,
    applicationId: string,
    input: {
      emailEnabled: boolean;
      inAppEnabled: boolean;
      expectedVersion: number;
    },
    now = new Date(),
  ) {
    return prisma.$transaction(async (tx) => {
      const application = await tx.jobApplication.findFirst({
        where: { id: applicationId, candidateUserId: actor.userId },
        select: { id: true },
      });
      if (!application) {
        throw new CandidateApplicationError(
          404,
          "APPLICATION_UNAVAILABLE",
          "This application is unavailable.",
        );
      }
      const current = await tx.applicationNotificationPreference.findUnique({
        where: { applicationId },
      });
      if (current && current.version !== input.expectedVersion) {
        throw new CandidateApplicationError(
          409,
          "APPLICATION_PREFERENCE_CONFLICT",
          "These notification settings changed. Refresh and try again.",
        );
      }
      if (!current && input.expectedVersion !== 1) {
        throw new CandidateApplicationError(
          409,
          "APPLICATION_PREFERENCE_CONFLICT",
          "These notification settings changed. Refresh and try again.",
        );
      }
      const next = current
        ? await tx.applicationNotificationPreference.updateMany({
            where: { applicationId, version: input.expectedVersion },
            data: {
              emailEnabled: input.emailEnabled,
              inAppEnabled: input.inAppEnabled,
              version: { increment: 1 },
              updatedAt: now,
            },
          })
        : null;
      if (current && next?.count !== 1) {
        throw new CandidateApplicationError(
          409,
          "APPLICATION_PREFERENCE_CONFLICT",
          "These notification settings changed. Refresh and try again.",
        );
      }
      const saved = current
        ? await tx.applicationNotificationPreference.findUniqueOrThrow({
            where: { applicationId },
          })
        : await tx.applicationNotificationPreference.create({
            data: {
              applicationId,
              emailEnabled: input.emailEnabled,
              inAppEnabled: input.inAppEnabled,
              version: 1,
              updatedAt: now,
            },
          });
      return notificationPreferenceSchema.parse({
        emailEnabled: saved.emailEnabled,
        inAppEnabled: saved.inAppEnabled,
        version: saved.version,
        updatedAt: saved.updatedAt.toISOString(),
      });
    }, { isolationLevel: "Serializable" });
  }
}
