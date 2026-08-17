import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import { createApplicationDocumentStorage } from "@/backend/applications/storage/factory";
import { ensureCandidateCvLibrary } from "@/backend/services/profile/candidate-cv-library";
import type { CandidateActor } from "@/backend/services/jobs/job-types";
import {
  applicationDraftSchema,
  applicationFileDescriptorSchema,
  applicationReviewSchema,
  candidatePersonalInfoSchema,
  coverLetterDraftSchema,
  saveApplicationDraftCommandSchema,
  type ApplicationDraft,
  type ApplicationReview,
  type CandidatePersonalInfo,
} from "@/shared/contracts/candidate-applications";
import { CandidateApplicationError } from "./candidate-application-errors";

const MAX_MESSAGE_LENGTH = 2_000;
const MAX_FILE_BYTES = 5_000_000;
const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
const supportedCvMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const coverLetterMimeTypes = new Set([...supportedCvMimeTypes]);

export type StoredCoverLetterDraft = {
  kind: "FILE";
  file: ApplicationDraftFileDescriptor & {
    storageKey: string;
    checksumSha256: string;
  };
};

type ApplicationDraftFileDescriptor = {
  versionId: string;
  displayName: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  parseStatus: "NOT_APPLICABLE";
};

type DraftDatabase = typeof prisma;

type CandidateContactRow = {
  user: { name: string; email: string };
  profile: { phone: string | null } | null;
};

function normalizedText(value: string | null | undefined, maximum: number) {
  const normalized = (value ?? "")
    .normalize("NFKC")
    .replace(/\r\n?/gu, "\n")
    .replace(/[^\S\n]+/gu, " ")
    .trim();
  if (Array.from(normalized).length > maximum) {
    throw new CandidateApplicationError(
      400,
      "APPLICATION_DRAFT_TEXT_TOO_LONG",
      "Shorten the application message before saving.",
    );
  }
  return normalized || null;
}

function normalizePersonalInfo(input: CandidatePersonalInfo) {
  const value = candidatePersonalInfoSchema.parse({
    fullName: input.fullName.normalize("NFKC").trim(),
    email: input.email.normalize("NFKC").trim(),
    phone: input.phone.normalize("NFKC").trim(),
  });
  return value;
}

function isSupportedFile(file: {
  mimeType: string;
  byteSize: number;
  fileName?: string;
}) {
  if (
    !supportedCvMimeTypes.has(file.mimeType) ||
    !Number.isSafeInteger(file.byteSize) ||
    file.byteSize < 1 ||
    file.byteSize > MAX_FILE_BYTES
  ) {
    return false;
  }
  const extension = file.fileName?.toLowerCase().split(".").pop();
  return extension === "pdf" || extension === "doc" || extension === "docx";
}

function safeFilename(value: string) {
  const normalized = value
    .normalize("NFKC")
    .replace(/[\\/\r\n]/gu, "_")
    .replace(/[^\p{L}\p{N}._ -]/gu, "_")
    .trim()
    .slice(0, 255);
  return normalized || "cover-letter";
}

function fileStream(file: File): AsyncIterable<Uint8Array> {
  return (async function* () {
    const reader = file.stream().getReader();
    try {
      while (true) {
        const result = await reader.read();
        if (result.done) return;
        yield result.value;
      }
    } finally {
      reader.releaseLock();
    }
  })();
}

function fileDescriptor(row: {
  id: string;
  displayName: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  version: number;
  confirmedAt: Date | null;
}) {
  if (
    !row.confirmedAt ||
    !isSupportedFile(row) ||
    !supportedCvMimeTypes.has(row.mimeType)
  ) {
    return null;
  }
  return applicationFileDescriptorSchema.parse({
    versionId: row.id,
    displayName: row.displayName.trim() || row.fileName,
    fileName: row.fileName,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    version: row.version,
    parseStatus: "READY",
    confirmedAt: row.confirmedAt.toISOString(),
  });
}

function parseStoredCoverLetter(value: unknown) {
  if (value === null || value === undefined) return null;
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { kind?: unknown }).kind === "FILE"
  ) {
    const file = (value as { file?: unknown }).file;
    if (!file || typeof file !== "object" || Array.isArray(file)) return null;
    const rawFile = file as Record<string, unknown>;
    const parsedFile = applicationFileDescriptorSchema.safeParse({
      versionId: rawFile.versionId,
      displayName: rawFile.displayName,
      fileName: rawFile.fileName,
      mimeType: rawFile.mimeType,
      byteSize: rawFile.byteSize,
      version: rawFile.version,
      parseStatus: rawFile.parseStatus ?? "NOT_APPLICABLE",
      confirmedAt: rawFile.confirmedAt,
    });
    if (!parsedFile.success) return null;
    return { kind: "FILE" as const, file: parsedFile.data };
  }
  const parsed = coverLetterDraftSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function storedCoverLetter(value: unknown): StoredCoverLetterDraft | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (value as { kind?: unknown }).kind !== "FILE"
  ) {
    return null;
  }
  const file = (value as { file?: unknown }).file;
  if (!file || typeof file !== "object" || Array.isArray(file)) return null;
  const parsed = file as Record<string, unknown>;
  if (
    typeof parsed.storageKey !== "string" ||
    typeof parsed.checksumSha256 !== "string" ||
    !parsed.storageKey ||
    !/^[a-f0-9]{64}$/iu.test(parsed.checksumSha256)
  ) {
    return null;
  }
  const publicFile = applicationFileDescriptorSchema.safeParse({
    versionId: parsed.versionId,
    displayName: parsed.displayName,
    fileName: parsed.fileName,
    mimeType: parsed.mimeType,
    byteSize: parsed.byteSize,
    parseStatus: "NOT_APPLICABLE",
  });
  if (!publicFile.success) return null;
  const fileName = publicFile.data.fileName ?? publicFile.data.displayName;
  return {
    kind: "FILE",
    file: {
      ...publicFile.data,
      fileName,
      parseStatus: "NOT_APPLICABLE" as const,
      storageKey: parsed.storageKey,
      checksumSha256: parsed.checksumSha256,
    },
  };
}

export async function validateStoredCoverLetter(value: unknown) {
  const stored = storedCoverLetter(value);
  if (!stored) return null;
  try {
    const storage = createApplicationDocumentStorage();
    await storage.assertReady();
    const hash = createHash("sha256");
    let bytes = 0;
    for await (const chunk of storage.open(
      stored.file.storageKey,
      stored.file.byteSize,
    )) {
      bytes += chunk.byteLength;
      if (bytes > stored.file.byteSize) return null;
      hash.update(Buffer.from(chunk));
    }
    if (bytes !== stored.file.byteSize) return null;
    if (hash.digest("hex") !== stored.file.checksumSha256) return null;
    return stored;
  } catch {
    return null;
  }
}

function initialPersonalInfo(candidate: CandidateContactRow): CandidatePersonalInfo {
  return normalizePersonalInfo({
    fullName: candidate.user.name,
    email: candidate.user.email,
    phone: candidate.profile?.phone ?? "",
  });
}

function personalInfoForApplication(
  candidate: CandidateContactRow,
  draftPersonalInfo: unknown,
): CandidatePersonalInfo {
  const profileInformation = initialPersonalInfo(candidate);
  const draftInformation = candidatePersonalInfoSchema.safeParse(draftPersonalInfo);
  return normalizePersonalInfo({
    fullName: profileInformation.fullName,
    email: profileInformation.email,
    // A profile phone remains authoritative when present. If it is missing,
    // allow the candidate to provide a bounded application-specific value.
    phone: profileInformation.phone || (draftInformation.success ? draftInformation.data.phone : ""),
  });
}

function draftProjection(row: {
  id: string;
  jobPostingId: string;
  revision: number;
  personalInfoDraft: unknown;
  selectedCv: {
    id: string;
    displayName: string;
    fileName: string;
    mimeType: string;
    byteSize: number;
    version: number;
    confirmedAt: Date | null;
  } | null;
  coverLetterDraft: unknown;
  messageDraft: string | null;
  confirmationAccepted: boolean;
  updatedAt: Date;
  expiresAt: Date;
}): ApplicationDraft {
  const personalInformation = candidatePersonalInfoSchema.parse(
    row.personalInfoDraft,
  );
  return applicationDraftSchema.parse({
    draftId: row.id,
    jobId: row.jobPostingId,
    revision: row.revision,
    personalInformation,
    cv: row.selectedCv ? fileDescriptor(row.selectedCv) : null,
    coverLetter: parseStoredCoverLetter(row.coverLetterDraft),
    message: row.messageDraft,
    confirmationAccepted: row.confirmationAccepted,
    updatedAt: row.updatedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  });
}

function openJobWhere(jobId: string | undefined, now: Date) {
  return {
    ...(jobId ? { id: jobId } : {}),
    status: "ACTIVE" as const,
    approvedAt: { not: null },
    publishedAt: { not: null, lte: now },
    OR: [{ applicationDeadline: null }, { applicationDeadline: { gt: now } }],
    company: { verifiedAt: { not: null } },
  };
}

async function candidateContact(db: DraftDatabase, candidateUserId: string) {
  const candidate = await db.candidateIdentity.findFirst({
    where: { userId: candidateUserId, user: { state: "ACTIVE" } },
    select: {
      user: { select: { name: true, email: true } },
      profile: { select: { phone: true } },
    },
  });
  if (!candidate) {
    throw new CandidateApplicationError(
      404,
      "APPLICATION_UNAVAILABLE",
      "This application is unavailable.",
    );
  }
  return candidate;
}

export async function validCv(
  db: DraftDatabase,
  candidateUserId: string,
  cvId: string | null,
) {
  if (!cvId) return null;
  const cv = await db.candidateCv.findFirst({
    where: {
      id: cvId,
      candidateUserId,
      confirmedAt: { not: null },
      archivedAt: null,
      byteSize: { gte: 1, lte: MAX_FILE_BYTES },
      mimeType: { in: [...supportedCvMimeTypes] },
    },
    select: {
      id: true,
      displayName: true,
      fileName: true,
      mimeType: true,
      byteSize: true,
      version: true,
      confirmedAt: true,
      checksumSha256: true,
      storageKey: true,
    },
  });
  if (!cv || !fileDescriptor(cv) || !/^[a-f0-9]{64}$/iu.test(cv.checksumSha256)) {
    throw new CandidateApplicationError(
      400,
      "APPLICATION_CV_INELIGIBLE",
      "Select a confirmed, readable CV from your Profile.",
    );
  }
  return cv;
}

async function optionalValidCv(
  db: DraftDatabase,
  candidateUserId: string,
  cvId: string | null | undefined,
) {
  if (!cvId) return null;
  try {
    return await validCv(db, candidateUserId, cvId);
  } catch (error) {
    if (
      error instanceof CandidateApplicationError &&
      error.code === "APPLICATION_CV_INELIGIBLE"
    ) {
      // A stale private-match link must not block the new application flow or
      // silently select a different CV as its replacement.
      return null;
    }
    throw error;
  }
}

async function draftRow(
  db: DraftDatabase,
  candidateUserId: string,
  jobId: string,
) {
  return db.candidateApplicationDraft.findUnique({
    where: {
      candidateUserId_jobPostingId: {
        candidateUserId,
        jobPostingId: jobId,
      },
    },
    include: {
      selectedCv: {
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
  });
}

export class ApplicationDraftService {
  constructor(private readonly db: DraftDatabase = prisma) {}

  async jobBySlug(slug: string, now = new Date()) {
    const job = await this.db.jobPosting.findFirst({
      where: {
        slug,
        ...openJobWhere(undefined, now),
      },
      select: {
        id: true,
        slug: true,
        title: true,
        location: true,
        company: { select: { displayName: true } },
      },
    });
    return job;
  }

  private async assertOpenJob(jobId: string, now: Date) {
    const job = await this.db.jobPosting.findFirst({
      where: openJobWhere(jobId, now),
      select: {
        id: true,
        slug: true,
        title: true,
        location: true,
        company: { select: { displayName: true } },
      },
    });
    if (!job) {
      throw new CandidateApplicationError(
        404,
        "JOB_UNAVAILABLE",
        "This job is no longer accepting applications.",
      );
    }
    return job;
  }

  async getOrCreate(
    actor: CandidateActor,
    jobId: string,
    now = new Date(),
    prefilledCvId?: string | null,
  ) {
    await ensureCandidateCvLibrary(actor.userId, this.db);
    await this.assertOpenJob(jobId, now);
    const candidate = await candidateContact(this.db, actor.userId);
    const result = await this.db.$transaction(async (tx) => {
      const existingApplication = await tx.jobApplication.findUnique({
        where: {
          candidateUserId_jobPostingId: {
            candidateUserId: actor.userId,
            jobPostingId: jobId,
          },
        },
        select: { id: true },
      });
      if (existingApplication) {
        throw new CandidateApplicationError(
          409,
          "APPLICATION_EXISTS",
          "You already applied to this job.",
        );
      }
      const existing = await draftRow(tx as DraftDatabase, actor.userId, jobId);
      if (existing && existing.expiresAt > now) {
        if (!existing.selectedCv && prefilledCvId) {
          const cv = await optionalValidCv(
            tx as DraftDatabase,
            actor.userId,
            prefilledCvId,
          );
          if (cv) {
            const updated = await tx.candidateApplicationDraft.update({
              where: { id: existing.id },
              data: {
                selectedCvId: cv.id,
                revision: { increment: 1 },
                updatedAt: now,
                expiresAt: new Date(now.getTime() + DRAFT_TTL_MS),
              },
              include: {
                selectedCv: {
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
            });
            return updated;
          }
        }
        return existing;
      }
      if (existing) {
        await tx.candidateApplicationDraft.delete({ where: { id: existing.id } });
      }
      const requested = await optionalValidCv(
        tx as DraftDatabase,
        actor.userId,
        prefilledCvId,
      );
      let selectedCvId = requested?.id ?? null;
      if (!selectedCvId && !prefilledCvId) {
        const firstCv = await tx.candidateCv.findFirst({
          where: {
            candidateUserId: actor.userId,
            confirmedAt: { not: null },
            archivedAt: null,
            byteSize: { gte: 1, lte: MAX_FILE_BYTES },
            mimeType: { in: [...supportedCvMimeTypes] },
          },
          orderBy: [{ confirmedAt: "desc" }, { id: "desc" }],
          select: { id: true },
        });
        selectedCvId = firstCv?.id ?? null;
      }
      return tx.candidateApplicationDraft.create({
        data: {
          candidateUserId: actor.userId,
          jobPostingId: jobId,
          revision: 1,
          personalInfoDraft: initialPersonalInfo(candidate) as Prisma.InputJsonValue,
          selectedCvId,
          coverLetterDraft: Prisma.JsonNull,
          messageDraft: null,
          confirmationAccepted: false,
          updatedAt: now,
          expiresAt: new Date(now.getTime() + DRAFT_TTL_MS),
        },
        include: {
          selectedCv: {
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
      });
    });
    return draftProjection(result);
  }

  async get(actor: CandidateActor, jobId: string, now = new Date()) {
    await ensureCandidateCvLibrary(actor.userId, this.db);
    const row = await draftRow(this.db, actor.userId, jobId);
    if (!row) return null;
    if (row.expiresAt <= now) {
      await this.db.candidateApplicationDraft.delete({ where: { id: row.id } });
      return null;
    }
    return draftProjection(row);
  }

  async currentPersonalInfo(actor: CandidateActor, draftPersonalInfo?: unknown) {
    return personalInfoForApplication(
      await candidateContact(this.db, actor.userId),
      draftPersonalInfo,
    );
  }

  async existingApplication(actor: CandidateActor, jobId: string) {
    return this.db.jobApplication.findUnique({
      where: {
        candidateUserId_jobPostingId: {
          candidateUserId: actor.userId,
          jobPostingId: jobId,
        },
      },
      select: { id: true },
    });
  }

  async save(actor: CandidateActor, raw: unknown, now = new Date()) {
    const command = saveApplicationDraftCommandSchema.parse(raw);
    await ensureCandidateCvLibrary(actor.userId, this.db);
    await this.assertOpenJob(command.jobId, now);
    const existingApplication = await this.db.jobApplication.findUnique({
      where: {
        candidateUserId_jobPostingId: {
          candidateUserId: actor.userId,
          jobPostingId: command.jobId,
        },
      },
      select: { id: true },
    });
    if (existingApplication) {
      throw new CandidateApplicationError(
        409,
        "APPLICATION_EXISTS",
        "You already applied to this job.",
      );
    }
    const candidate = await candidateContact(this.db, actor.userId);
    const personalInformation = personalInfoForApplication(
      candidate,
      command.personalInformation,
    );
    const message = normalizedText(command.message, MAX_MESSAGE_LENGTH);
    const coverLetter = command.coverLetter
      ? coverLetterDraftSchema.parse(command.coverLetter)
      : null;
    const selectedCv = command.cvVersionId
      ? await validCv(this.db, actor.userId, command.cvVersionId)
      : null;
    const current = await draftRow(this.db, actor.userId, command.jobId);
    let storedCoverLetterValue: Prisma.InputJsonValue | typeof Prisma.JsonNull =
      Prisma.JsonNull;
    if (coverLetter?.kind === "TEXT") {
      storedCoverLetterValue = coverLetter as Prisma.InputJsonValue;
    } else if (coverLetter?.kind === "FILE") {
      const previous =
        current && current.expiresAt > now
          ? storedCoverLetter(current.coverLetterDraft)
          : null;
      if (!previous || previous.file.versionId !== coverLetter.file.versionId) {
        throw new CandidateApplicationError(
          400,
          "APPLICATION_COVER_LETTER_INELIGIBLE",
          "Upload the cover letter again before saving this draft.",
        );
      }
      storedCoverLetterValue = previous as unknown as Prisma.InputJsonValue;
    }
    if (current && current.expiresAt <= now) {
      await this.db.candidateApplicationDraft.delete({ where: { id: current.id } });
    }
    if (
      current &&
      current.expiresAt > now &&
      command.expectedRevision !== null &&
      current.revision !== command.expectedRevision
    ) {
      throw new CandidateApplicationError(
        409,
        "APPLICATION_DRAFT_CONFLICT",
        "This application draft changed in another tab. Refresh and try again.",
      );
    }
    if (current && current.expiresAt > now) {
      const changed = await this.db.candidateApplicationDraft.updateMany({
        where: {
          id: current.id,
          candidateUserId: actor.userId,
          jobPostingId: command.jobId,
          revision: current.revision,
          expiresAt: { gt: now },
        },
        data: {
          revision: current.revision + 1,
          personalInfoDraft: personalInformation as Prisma.InputJsonValue,
          selectedCvId: selectedCv?.id ?? null,
          coverLetterDraft: storedCoverLetterValue,
          messageDraft: message,
          confirmationAccepted: command.confirmationAccepted,
          updatedAt: now,
          expiresAt: new Date(now.getTime() + DRAFT_TTL_MS),
        },
      });
      if (changed.count !== 1) {
        throw new CandidateApplicationError(
          409,
          "APPLICATION_DRAFT_CONFLICT",
          "This application draft changed in another tab. Refresh it and try again.",
        );
      }
      const saved = await draftRow(this.db, actor.userId, command.jobId);
      if (!saved) {
        throw new CandidateApplicationError(
          503,
          "APPLICATION_DRAFT_UNAVAILABLE",
          "The application draft could not be saved.",
        );
      }
      if (
        storedCoverLetter(current.coverLetterDraft) &&
        (coverLetter?.kind !== "FILE" ||
          coverLetter.file.versionId !==
            storedCoverLetter(current.coverLetterDraft)?.file.versionId)
      ) {
        await createApplicationDocumentStorage()
          .delete(storedCoverLetter(current.coverLetterDraft)!.file.storageKey)
          .catch(() => undefined);
      }
      return draftProjection(saved);
    }
    const revision = 1;
    const saved = await this.db.candidateApplicationDraft.upsert({
      where: {
        candidateUserId_jobPostingId: {
          candidateUserId: actor.userId,
          jobPostingId: command.jobId,
        },
      },
      create: {
        candidateUserId: actor.userId,
        jobPostingId: command.jobId,
        revision,
        personalInfoDraft: personalInformation as Prisma.InputJsonValue,
        selectedCvId: selectedCv?.id ?? null,
        coverLetterDraft: storedCoverLetterValue,
        messageDraft: message,
        confirmationAccepted: command.confirmationAccepted,
        updatedAt: now,
        expiresAt: new Date(now.getTime() + DRAFT_TTL_MS),
      },
      update: {
        revision,
        personalInfoDraft: personalInformation as Prisma.InputJsonValue,
        selectedCvId: selectedCv?.id ?? null,
        coverLetterDraft: storedCoverLetterValue,
        messageDraft: message,
        confirmationAccepted: command.confirmationAccepted,
        updatedAt: now,
        expiresAt: new Date(now.getTime() + DRAFT_TTL_MS),
      },
      include: {
        selectedCv: {
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
    });
    if (
      current &&
      storedCoverLetter(current.coverLetterDraft) &&
      (coverLetter?.kind !== "FILE" ||
        coverLetter.file.versionId !==
          storedCoverLetter(current.coverLetterDraft)?.file.versionId)
    ) {
      await createApplicationDocumentStorage()
        .delete(storedCoverLetter(current.coverLetterDraft)!.file.storageKey)
        .catch(() => undefined);
    }
    // Keep the profile as the source of truth for the review display. The
    // draft stores a bounded snapshot only so a partially completed wizard is
    // resumable; submission revalidates this contact again.
    void candidate;
    return draftProjection(saved);
  }

  async review(actor: CandidateActor, draftId: string, now = new Date()): Promise<ApplicationReview> {
    await ensureCandidateCvLibrary(actor.userId, this.db);
    const row = await this.db.candidateApplicationDraft.findFirst({
      where: { id: draftId, candidateUserId: actor.userId },
      include: {
        jobPosting: {
          select: {
            id: true,
            slug: true,
            title: true,
            location: true,
            status: true,
            approvedAt: true,
            publishedAt: true,
            applicationDeadline: true,
            company: { select: { displayName: true, verifiedAt: true } },
          },
        },
        selectedCv: {
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
    });
    if (!row || row.expiresAt <= now) {
      if (row) await this.db.candidateApplicationDraft.delete({ where: { id: row.id } });
      throw new CandidateApplicationError(
        404,
        "APPLICATION_DRAFT_NOT_FOUND",
        "This application draft is unavailable. Start again from the job page.",
      );
    }
    const jobOpen =
      row.jobPosting.status === "ACTIVE" &&
      row.jobPosting.approvedAt !== null &&
      row.jobPosting.publishedAt !== null &&
      row.jobPosting.publishedAt <= now &&
      (row.jobPosting.applicationDeadline === null || row.jobPosting.applicationDeadline > now) &&
      row.jobPosting.company.verifiedAt !== null;
    if (!jobOpen) {
      throw new CandidateApplicationError(
        409,
        "JOB_UNAVAILABLE",
        "This job is no longer accepting applications.",
      );
    }
    const candidate = await candidateContact(this.db, actor.userId);
    const currentInfo = personalInfoForApplication(
      candidate,
      row.personalInfoDraft,
    );
    const cv = await validCv(this.db, actor.userId, row.selectedCvId);
    if (
      row.coverLetterDraft &&
      typeof row.coverLetterDraft === "object" &&
      !Array.isArray(row.coverLetterDraft) &&
      (row.coverLetterDraft as { kind?: unknown }).kind === "FILE" &&
      !(await validateStoredCoverLetter(row.coverLetterDraft))
    ) {
      throw new CandidateApplicationError(
        409,
        "APPLICATION_COVER_LETTER_INELIGIBLE",
        "The cover letter needs to be uploaded again before review.",
      );
    }
    const draft = draftProjection({
      ...row,
      personalInfoDraft: currentInfo,
      selectedCv: cv,
    });
    return applicationReviewSchema.parse({
      job: {
        id: row.jobPosting.id,
        slug: row.jobPosting.slug,
        title: row.jobPosting.title,
        companyName: row.jobPosting.company.displayName,
        location: row.jobPosting.location,
        isOpen: jobOpen,
      },
      draft,
    });
  }

  async getForSubmission(
    actor: CandidateActor,
    draftId: string,
    now = new Date(),
  ) {
    const row = await this.db.candidateApplicationDraft.findFirst({
      where: {
        id: draftId,
        candidateUserId: actor.userId,
        expiresAt: { gt: now },
      },
      select: {
        id: true,
        candidateUserId: true,
        jobPostingId: true,
        revision: true,
        personalInfoDraft: true,
        selectedCvId: true,
        coverLetterDraft: true,
        messageDraft: true,
        confirmationAccepted: true,
      },
    });
    if (!row) {
      throw new CandidateApplicationError(
        404,
        "APPLICATION_DRAFT_NOT_FOUND",
        "This application draft is unavailable. Start again from the job page.",
      );
    }
    return row;
  }

  async attachCoverLetter(
    actor: CandidateActor,
    draftId: string,
    expectedRevision: number,
    file: File,
    now = new Date(),
  ) {
    const draft = await this.db.candidateApplicationDraft.findFirst({
      where: {
        id: draftId,
        candidateUserId: actor.userId,
        expiresAt: { gt: now },
      },
      include: {
        selectedCv: {
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
    });
    if (!draft || draft.revision !== expectedRevision) {
      throw new CandidateApplicationError(
        409,
        "APPLICATION_DRAFT_CONFLICT",
        "This application draft changed in another tab. Refresh and try again.",
      );
    }
    const existingApplication = await this.db.jobApplication.findUnique({
      where: {
        candidateUserId_jobPostingId: {
          candidateUserId: actor.userId,
          jobPostingId: draft.jobPostingId,
        },
      },
      select: { id: true },
    });
    if (existingApplication) {
      throw new CandidateApplicationError(
        409,
        "APPLICATION_EXISTS",
        "You already applied to this job.",
      );
    }
    const extension = file.name.toLowerCase().split(".").pop();
    const mimeType = coverLetterMimeTypes.has(file.type)
      ? file.type
      : extension === "pdf"
        ? "application/pdf"
        : extension === "doc"
          ? "application/msword"
          : extension === "docx"
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : null;
    if (
      !mimeType ||
      file.size < 1 ||
      file.size > MAX_FILE_BYTES ||
      !["pdf", "doc", "docx"].includes(extension ?? "")
    ) {
      throw new CandidateApplicationError(
        400,
        "APPLICATION_COVER_LETTER_INELIGIBLE",
        "Cover letters must be PDF, DOC, or DOCX files between 1 and 5 MB.",
      );
    }
    const storage = createApplicationDocumentStorage();
    await storage.assertReady();
    const hash = createHash("sha256");
    let stored: Awaited<ReturnType<typeof storage.put>>;
    try {
      stored = await storage.put({
        expectedBytes: file.size,
        source: (async function* () {
          for await (const chunk of fileStream(file)) {
            const bytes = Buffer.from(chunk);
            hash.update(bytes);
            yield bytes;
          }
        })(),
      });
    } catch {
      throw new CandidateApplicationError(
        503,
        "APPLICATION_STORAGE_UNAVAILABLE",
        "The cover letter could not be saved. Try again in a moment.",
      );
    }
    const descriptor: StoredCoverLetterDraft = {
      kind: "FILE",
      file: {
        versionId: randomUUID(),
        displayName: safeFilename(file.name),
        fileName: safeFilename(file.name),
        mimeType,
        byteSize: file.size,
        parseStatus: "NOT_APPLICABLE",
        storageKey: stored.locator,
        checksumSha256: hash.digest("hex"),
      },
    };
    try {
      const changed = await this.db.candidateApplicationDraft.updateMany({
        where: {
          id: draft.id,
          candidateUserId: actor.userId,
          revision: expectedRevision,
          expiresAt: { gt: now },
        },
        data: {
          revision: { increment: 1 },
          coverLetterDraft: descriptor as unknown as Prisma.InputJsonValue,
          updatedAt: now,
          expiresAt: new Date(now.getTime() + DRAFT_TTL_MS),
        },
      });
      if (changed.count !== 1) {
        throw new CandidateApplicationError(
          409,
          "APPLICATION_DRAFT_CONFLICT",
          "This application draft changed in another tab. Refresh it and try again.",
        );
      }
      const updated = await draftRow(this.db, actor.userId, draft.jobPostingId);
      if (!updated) {
        throw new CandidateApplicationError(
          503,
          "APPLICATION_DRAFT_UNAVAILABLE",
          "The application draft could not be saved.",
        );
      }
      const previous = storedCoverLetter(draft.coverLetterDraft);
      if (previous) await storage.delete(previous.file.storageKey).catch(() => undefined);
      return draftProjection(updated);
    } catch (error) {
      await storage.delete(stored.locator).catch(() => undefined);
      throw error;
    }
  }
}
