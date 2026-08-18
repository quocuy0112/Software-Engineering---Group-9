import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/backend/database/prisma";
import { safeFilename } from "@/backend/services/cv-import/cv-import-projection";
import {
  applicationPageSchema,
  type ApplicationPage,
} from "@/shared/contracts/applications";
import type {
  ApplicationDocumentRecord,
  ApplicationRepositoryPort,
} from "./application-repository";

const cursorVersion = 1;
const cursorSecret = () =>
  process.env.APPLICATION_CURSOR_SECRET ?? "local-application-cursor-secret";

type Cursor = Readonly<{
  v: number;
  jobId: string;
  submittedAt: string;
  id: string;
}>;

function encodeCursor(cursor: Cursor): string {
  const body = Buffer.from(JSON.stringify(cursor), "utf8").toString(
    "base64url",
  );
  const signature = createHmac("sha256", cursorSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

function decodeCursor(value: string | undefined, jobId: string): Cursor | null {
  if (!value || value.length > 512) return null;
  const [body, signature] = value.split(".");
  if (!body || !signature) return null;
  const expected = createHmac("sha256", cursorSecret())
    .update(body)
    .digest("base64url");
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (
    actualBytes.length !== expectedBytes.length ||
    !timingSafeEqual(actualBytes, expectedBytes)
  ) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as Partial<Cursor>;
    if (
      parsed.v !== cursorVersion ||
      parsed.jobId !== jobId ||
      typeof parsed.id !== "string" ||
      typeof parsed.submittedAt !== "string" ||
      !Number.isFinite(Date.parse(parsed.submittedAt))
    ) {
      return null;
    }
    return parsed as Cursor;
  } catch {
    return null;
  }
}

function safeAvatar(value: string | null): string | null {
  if (!value || !/^https:\/\//iu.test(value)) return null;
  return value.length <= 500 ? value : null;
}

function sharedPhone(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const phone = (value as Record<string, unknown>).phone;
  return typeof phone === "string" && phone.length <= 32 ? phone : null;
}

function previewSupported(mediaType: string): boolean {
  return [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ].includes(mediaType);
}

function decodeCoverLetterText(value: string): string {
  if (!value.startsWith("b64:v1:")) return value;
  try {
    return Buffer.from(value.slice("b64:v1:".length), "base64").toString(
      "utf8",
    );
  } catch {
    return value;
  }
}

function isInternalFilename(value: string | null): boolean {
  return Boolean(
    value &&
    (/^(?:imported-cv|application-cv|candidate-cv)-[A-Za-z0-9-]+\.[A-Za-z0-9]{1,8}$/iu.test(
      value,
    ) ||
      /^[A-Za-z0-9_-]{32,128}\.[A-Za-z0-9]{1,8}$/u.test(value)),
  );
}

async function originalFilename(input: {
  db: typeof prisma;
  kind: "cv" | "cover-letter";
  application: {
    candidateUserId: string;
    selectedCvId: string;
    selectedCv: { fileName: string } | null;
  };
  document: {
    originalFilenameEncrypted: string;
    sourceCandidateCvId: string | null;
  };
}): Promise<string> {
  const stored = input.document.originalFilenameEncrypted;
  if (!isInternalFilename(stored)) return stored;
  const sourceId =
    input.document.sourceCandidateCvId ?? input.application.selectedCvId;
  if (sourceId.startsWith("candidate-cv-")) {
    const uploadId = sourceId.slice("candidate-cv-".length);
    const upload = await input.db.cvUpload.findFirst({
      where: { id: uploadId, accountId: input.application.candidateUserId },
      select: { accountId: true, displayFilenameCiphertext: true },
    });
    const recovered = safeFilename(upload?.displayFilenameCiphertext ?? null, {
      accountId: input.application.candidateUserId,
      uploadId,
    });
    if (recovered && !isInternalFilename(recovered)) return recovered;
  }
  const selected = input.application.selectedCv?.fileName;
  if (selected && !isInternalFilename(selected)) return selected;
  return input.kind === "cv" ? "candidate-cv.pdf" : "cover-letter.pdf";
}

function coverLetterProjection(row: {
  applicationDocuments: Array<{
    kind: string;
    mediaType: string;
    deletedAt: Date | null;
  }>;
  coverLetterText: { deletedAt: Date | null } | null;
  coverLetter: string | null;
}): ApplicationPage["items"][number]["coverLetter"] {
  const file = row.applicationDocuments.find(
    (document) => document.kind === "COVER_LETTER" && !document.deletedAt,
  );
  if (file) {
    return {
      kind: file.mediaType === "application/pdf" ? "PDF" : "DOCX",
      available: true,
      previewSupported: previewSupported(file.mediaType),
    };
  }
  if (row.coverLetterText && !row.coverLetterText.deletedAt) {
    return { kind: "TEXT", available: true, previewSupported: true };
  }
  if (row.coverLetter) {
    return { kind: "TEXT", available: true, previewSupported: true };
  }
  return { kind: "NONE" };
}

export class PrismaApplicationRepository implements ApplicationRepositoryPort {
  constructor(private readonly db: typeof prisma = prisma) {}

  async listSubmittedCandidates(input: {
    jobId: string;
    limit: number;
    cursor?: string;
    now?: Date;
  }): Promise<ApplicationPage> {
    const cursor = decodeCursor(input.cursor, input.jobId);
    if (input.cursor && !cursor) throw new Error("INVALID_CURSOR");
    const now = input.now ?? new Date();
    const rows = await this.db.jobApplication.findMany({
      where: {
        jobPostingId: input.jobId,
        legacyDocumentState: { not: "UNAVAILABLE" },
        documentDeletedAt: null,
        AND: [
          {
            OR: [
              { documentAccessDeniedAt: null },
              { documentAccessDeniedAt: { gt: now } },
            ],
          },
          ...(cursor
            ? [
                {
                  OR: [
                    { submittedAt: { lt: new Date(cursor.submittedAt) } },
                    {
                      submittedAt: new Date(cursor.submittedAt),
                      id: { lt: cursor.id },
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      take: Math.min(input.limit, 100) + 1,
      select: {
        id: true,
        submittedAt: true,
        stage: true,
        contactSnapshot: true,
        coverLetter: true,
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
        applicationDocuments: {
          where: { committedAt: { not: null }, deletedAt: null },
          select: { kind: true, mediaType: true, deletedAt: true },
        },
        coverLetterText: { select: { deletedAt: true } },
      },
    });
    const hasNext = rows.length > input.limit;
    const items = rows.slice(0, input.limit).flatMap((row) => {
      if (!row.candidate.user.emailVerified) return [];
      const cv = row.applicationDocuments.find(
        (document) => document.kind === "CV" && !document.deletedAt,
      );
      if (!cv) return [];
      return [
        {
          applicationId: row.id,
          candidate: {
            displayName: row.candidate.user.name,
            verifiedEmail: row.candidate.user.email,
            sharedPhone: sharedPhone(row.contactSnapshot),
            avatarUrl: safeAvatar(row.candidate.user.image),
          },
          submittedAt: row.submittedAt.toISOString(),
          stage: row.stage,
          cv: {
            available: true,
            mediaType: cv.mediaType as
              | "application/pdf"
              | "application/msword"
              | "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            previewSupported: previewSupported(cv.mediaType),
          },
          coverLetter: coverLetterProjection(row),
        },
      ];
    });
    const last = items.at(-1);
    const nextCursor =
      hasNext && last
        ? encodeCursor({
            v: cursorVersion,
            jobId: input.jobId,
            submittedAt: last.submittedAt,
            id: last.applicationId,
          })
        : null;
    return applicationPageSchema.parse({ items, nextCursor });
  }

  async findDocument(input: {
    jobId: string;
    applicationId: string;
    kind: "cv" | "cover-letter";
    now?: Date;
  }): Promise<ApplicationDocumentRecord | null> {
    const now = input.now ?? new Date();
    const application = await this.db.jobApplication.findFirst({
      where: {
        id: input.applicationId,
        jobPostingId: input.jobId,
        legacyDocumentState: { not: "UNAVAILABLE" },
        documentDeletedAt: null,
        OR: [
          { documentAccessDeniedAt: null },
          { documentAccessDeniedAt: { gt: now } },
        ],
      },
      select: {
        id: true,
        stage: true,
        stageVersion: true,
        candidateUserId: true,
        selectedCvId: true,
        jobPostingId: true,
        coverLetter: true,
        profileSnapshot: true,
        selectedCv: { select: { fileName: true } },
        applicationDocuments: {
          where: {
            kind: input.kind === "cv" ? "CV" : "COVER_LETTER",
            committedAt: { not: null },
            deletedAt: null,
          },
          select: {
            kind: true,
            originalFilenameEncrypted: true,
            contentDigestHmac: true,
            sourceCandidateCvId: true,
            mediaType: true,
            byteLength: true,
            storageKeyEncrypted: true,
          },
          take: 1,
        },
        coverLetterText: {
          select: {
            textEncrypted: true,
            characterCount: true,
            deletedAt: true,
          },
        },
      },
    });
    if (!application) return null;
    if (
      input.kind === "cover-letter" &&
      application.applicationDocuments.length === 0
    ) {
      const text =
        application.coverLetterText && !application.coverLetterText.deletedAt
          ? decodeCoverLetterText(application.coverLetterText.textEncrypted)
          : application.coverLetter
            ? decodeCoverLetterText(application.coverLetter)
            : null;
      if (!text || text.length === 0) return null;
      return {
        applicationId: application.id,
        jobId: application.jobPostingId,
        stage: application.stage,
        stageVersion: application.stageVersion,
        kind: "cover-letter",
        fileName: null,
        mediaType: "text/plain",
        byteLength: Buffer.byteLength(text, "utf8"),
        storageKey: null,
        text,
        previewSupported: true,
        contentVersion: createHash("sha256").update(text, "utf8").digest("hex"),
        applicationProfileSnapshot: application.profileSnapshot,
        sourceCandidateCvId: null,
      };
    }
    const document = application.applicationDocuments[0];
    if (!document) return null;
    return {
      applicationId: application.id,
      jobId: application.jobPostingId,
      stage: application.stage,
      stageVersion: application.stageVersion,
      kind: input.kind,
      fileName: await originalFilename({
        db: this.db,
        kind: input.kind,
        application,
        document,
      }),
      mediaType: document.mediaType,
      byteLength: document.byteLength,
      storageKey: document.storageKeyEncrypted,
      text: null,
      previewSupported: previewSupported(document.mediaType),
      contentVersion: document.contentDigestHmac,
      applicationProfileSnapshot: application.profileSnapshot,
      sourceCandidateCvId: document.sourceCandidateCvId,
    };
  }
}
