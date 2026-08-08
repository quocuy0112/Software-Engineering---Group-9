import "server-only";

import { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import { applicationContactSnapshotSchema } from "@/shared/contracts/jobs/actions";
import {
  appliedJobStateSchema,
  type AppliedJobState,
  type JobPreferences,
  type UserJobState,
  userJobStateSchema,
} from "@/shared/contracts/jobs/catalog";
import {
  defaultJobPreferences,
  jobPreferencesSchema,
} from "@/shared/contracts/jobs/preferences";
import { z } from "zod";

const hiddenJobIdsSchema = z.array(z.string().min(1).max(128)).max(10_000);
const savedFilterPresetsSchema = z
  .array(
    z
      .object({
        id: z.string().min(1).max(128),
        name: z.string().min(1).max(160),
        filters: z.record(z.string(), z.unknown()),
      })
      .strict(),
  )
  .max(100);

export type UserJobStateMutation =
  | { action: "save"; jobId: string }
  | { action: "unsave"; jobId: string }
  | { action: "hide"; jobId: string }
  | { action: "unhide"; jobId: string }
  | { action: "update-preferences"; jobPreferences: JobPreferences }
  | { action: "apply"; jobId: string; appliedJob: AppliedJobState };

function applicationStatus(stage: string): AppliedJobState["status"] {
  switch (stage) {
    case "VIEWED":
      return "viewed";
    case "SHORTLISTED":
    case "INTERVIEWING":
    case "OFFERED":
    case "HIRED":
      return "considering";
    case "WAITLISTED":
      return "matched";
    case "OFFER_DECLINED":
    case "REJECTED":
      return "not_fit";
    default:
      return "submitted";
  }
}

type CandidateContact = {
  name: string;
  email: string;
  phone: string | null;
};

function fallbackContactSnapshot(
  candidate: CandidateContact | null,
): AppliedJobState["contactSnapshot"] {
  const parsed = applicationContactSnapshotSchema.safeParse({
    fullName: candidate?.name?.trim() || "Candidate",
    email: candidate?.email || "candidate@example.com",
    phone: candidate?.phone?.trim() || "0900000000",
  });
  return parsed.success
    ? parsed.data
    : {
        fullName: "Candidate",
        email: "candidate@example.com",
        phone: "0900000000",
      };
}

function projectApplication(
  row: {
    jobPostingId: string;
    submittedAt: Date;
    stage: string;
    cvFileRef: string | null;
    contactSnapshot: unknown;
    aiAnalysisConsent: boolean;
    aiMatchScore: number | null;
  },
  candidate: CandidateContact | null,
): AppliedJobState {
  const contact = applicationContactSnapshotSchema.safeParse(
    row.contactSnapshot,
  );
  return appliedJobStateSchema.parse({
    jobId: row.jobPostingId,
    appliedAt: row.submittedAt.toISOString(),
    status: applicationStatus(row.stage),
    cvFileRef: row.cvFileRef,
    contactSnapshot: contact.success
      ? contact.data
      : fallbackContactSnapshot(candidate),
    aiAnalysisConsent: row.aiAnalysisConsent,
    aiMatchScore: row.aiMatchScore,
  });
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function readUserJobState(userId: string): Promise<UserJobState> {
  const [savedJobs, applications, workspace, account] = await Promise.all([
    prisma.savedJob.findMany({
      where: { userId },
      orderBy: [{ createdAt: "asc" }, { jobPostingId: "asc" }],
      select: { jobPostingId: true },
    }),
    prisma.jobApplication.findMany({
      where: { candidateUserId: userId },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      select: {
        jobPostingId: true,
        submittedAt: true,
        stage: true,
        cvFileRef: true,
        contactSnapshot: true,
        aiAnalysisConsent: true,
        aiMatchScore: true,
      },
    }),
    prisma.userJobWorkspaceState.findUnique({
      where: { userId },
      select: {
        hiddenJobIds: true,
        jobPreferences: true,
        savedFilterPresets: true,
      },
    }),
    prisma.userAccount.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        candidateIdentity: {
          select: { profile: { select: { phone: true } } },
        },
      },
    }),
  ]);

  const candidate: CandidateContact | null = account
    ? {
        name: account.name,
        email: account.email,
        phone: account.candidateIdentity?.profile?.phone ?? null,
      }
    : null;
  const preferences = jobPreferencesSchema.safeParse(workspace?.jobPreferences);
  const hiddenJobIds = hiddenJobIdsSchema.safeParse(workspace?.hiddenJobIds);
  const savedFilterPresets = savedFilterPresetsSchema.safeParse(
    workspace?.savedFilterPresets,
  );

  return userJobStateSchema.parse({
    userId,
    savedJobIds: savedJobs.map((job) => job.jobPostingId),
    hiddenJobIds: hiddenJobIds.success ? hiddenJobIds.data : [],
    appliedJobs: applications.map((application) =>
      projectApplication(application, candidate),
    ),
    jobPreferences: preferences.success
      ? preferences.data
      : defaultJobPreferences,
    savedFilterPresets: savedFilterPresets.success
      ? savedFilterPresets.data
      : [],
  });
}

export function projectUserJobState(state: UserJobState) {
  return {
    savedJobIds: state.savedJobIds,
    hiddenJobIds: state.hiddenJobIds,
    appliedJobIds: state.appliedJobs.map((application) => application.jobId),
  };
}

async function persistWorkspaceState(
  userId: string,
  state: UserJobState,
): Promise<void> {
  await prisma.userJobWorkspaceState.upsert({
    where: { userId },
    create: {
      userId,
      hiddenJobIds: jsonValue(state.hiddenJobIds),
      jobPreferences: jsonValue(state.jobPreferences),
      savedFilterPresets: jsonValue(state.savedFilterPresets),
    },
    update: {
      hiddenJobIds: jsonValue(state.hiddenJobIds),
      jobPreferences: jsonValue(state.jobPreferences),
      savedFilterPresets: jsonValue(state.savedFilterPresets),
    },
  });
}

export async function updateUserJobState(
  userId: string,
  mutation: UserJobStateMutation,
): Promise<UserJobState> {
  switch (mutation.action) {
    case "save":
      await prisma.savedJob.createMany({
        data: { userId, jobPostingId: mutation.jobId },
        skipDuplicates: true,
      });
      break;
    case "unsave":
      await prisma.savedJob.deleteMany({
        where: { userId, jobPostingId: mutation.jobId },
      });
      break;
    case "hide": {
      const current = await readUserJobState(userId);
      if (!current.hiddenJobIds.includes(mutation.jobId)) {
        await persistWorkspaceState(userId, {
          ...current,
          hiddenJobIds: [...current.hiddenJobIds, mutation.jobId],
        });
      }
      break;
    }
    case "unhide": {
      const current = await readUserJobState(userId);
      await persistWorkspaceState(userId, {
        ...current,
        hiddenJobIds: current.hiddenJobIds.filter(
          (jobId) => jobId !== mutation.jobId,
        ),
      });
      break;
    }
    case "update-preferences": {
      const current = await readUserJobState(userId);
      await persistWorkspaceState(userId, {
        ...current,
        jobPreferences: mutation.jobPreferences,
      });
      break;
    }
    case "apply":
      // Applications are written by the application submission service. Read
      // the authoritative JobApplication rows below instead of mirroring a
      // client payload into a second user-state store.
      break;
  }

  return readUserJobState(userId);
}
