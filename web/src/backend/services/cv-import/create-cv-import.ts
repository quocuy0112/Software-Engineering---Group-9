import "server-only";

import { createHmac, randomUUID } from "node:crypto";

import { cvConfiguration, cvParserAvailability } from "@/backend/cv/config";
import { createMetadataCryptor } from "@/backend/cv/encryption/metadata-cryptor";
import { prisma } from "@/backend/database/prisma";
import { serverEnvironment } from "@/backend/env/runtime";
import { PrismaCvQuotaRepository } from "@/backend/repositories/cv-import/prisma-cv-quota-repository";
import { logCvUploadRejection } from "@/backend/cv/upload-observability";
import { CvImportServiceError } from "./cv-http-errors";
import { canonicalJson } from "@/shared/contracts/cv-import/common";
import {
  createCvImportRequestSchema,
  cvProcessingNotice,
  cvUploadReservationSchema,
  type CreateCvImportRequest,
  type CvUploadReservation,
} from "@/shared/contracts/cv-import/upload";

type CreateCvImportDependencies = Readonly<{
  findProfileId(accountId: string): Promise<string | null>;
  reserve: PrismaCvQuotaRepository["reserve"];
  encryptDisplayFilename(
    filename: string,
    context: { accountId: string; uploadId: string },
  ): string;
  audit(input: {
    accountId: string;
    uploadId: string;
    parserClass: CreateCvImportRequest["parserClass"];
    noticeVersion: string;
    occurredAt: Date;
  }): Promise<void>;
  newId(): string;
  idempotencySecret: string;
  now(): Date;
  parserAllowed(parserClass: CreateCvImportRequest["parserClass"]): boolean;
}>;

function hmac(secret: string, purpose: string, value: string): Buffer {
  return createHmac("sha256", secret)
    .update(`smarthire:cv-import:${purpose}:v1\0`, "utf8")
    .update(value, "utf8")
    .digest();
}

function normalizeFilename(value: string): string {
  const filename = value.normalize("NFKC").trim();
  const hasControlCharacter = Array.from(filename).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
  });
  if (
    !filename ||
    filename.length > 255 ||
    filename.includes("/") ||
    filename.includes("\\") ||
    hasControlCharacter
  ) {
    throw new CvImportServiceError("VALIDATION_ERROR");
  }
  return filename;
}

function documentKind(
  filename: string,
  mediaType: CreateCvImportRequest["declaredMediaType"],
): "PDF" | "DOC" | "DOCX" {
  const extension = filename.toLocaleLowerCase("en-US").split(".").at(-1);
  if (extension === "pdf" && mediaType === "application/pdf") return "PDF";
  if (extension === "doc" && mediaType === "application/msword") return "DOC";
  if (
    extension === "docx" &&
    mediaType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "DOCX";
  }
  throw new CvImportServiceError("UNSUPPORTED_MEDIA_TYPE");
}

function defaultDependencies(): CreateCvImportDependencies {
  const parserAvailability = cvParserAvailability(cvConfiguration);
  const keys = Object.fromEntries(
    Object.entries(cvConfiguration.encryption.encodedKeys).map(
      ([version, key]) => [Number(version), Buffer.from(key, "base64")],
    ),
  );
  const metadata = createMetadataCryptor({
    activeKeyVersion: cvConfiguration.encryption.activeKeyVersion,
    keys,
  });
  const quota = new PrismaCvQuotaRepository();
  return {
    async findProfileId(accountId) {
      const profile = await prisma.candidateProfile.findFirst({
        where: {
          candidateUserId: accountId,
          candidate: { user: { state: "ACTIVE", deletedAt: null } },
        },
        select: { id: true },
      });
      return profile?.id ?? null;
    },
    reserve: quota.reserve.bind(quota),
    encryptDisplayFilename: metadata.encryptDisplayFilename,
    audit: async () => undefined,
    newId: randomUUID,
    idempotencySecret: serverEnvironment.TOKEN_SECRET,
    now: () => new Date(),
    parserAllowed: (parserClass) =>
      parserClass === "DETERMINISTIC_INTERNAL"
        ? parserAvailability.deterministic
        : parserAvailability.external,
  };
}

export class CreateCvImportService {
  constructor(
    private readonly dependencies: CreateCvImportDependencies = defaultDependencies(),
  ) {}

  async execute(input: {
    accountId: string;
    idempotencyKey: string;
    request: CreateCvImportRequest;
  }): Promise<
    Readonly<{
      reservation: CvUploadReservation;
      processingNotice: ReturnType<typeof cvProcessingNotice>;
      replayed: boolean;
    }>
  > {
    const request = createCvImportRequestSchema.parse(input.request);
    if (!this.dependencies.parserAllowed(request.parserClass)) {
      throw new CvImportServiceError("CV_PROCESSING_UNAVAILABLE");
    }
    const profileId = await this.dependencies.findProfileId(input.accountId);
    if (!profileId) throw new CvImportServiceError("FORBIDDEN");
    const filename = normalizeFilename(request.displayFilename);
    let kind: "PDF" | "DOC" | "DOCX";
    try {
      kind = documentKind(filename, request.declaredMediaType);
    } catch (error) {
      if (
        error instanceof CvImportServiceError &&
        error.code === "UNSUPPORTED_MEDIA_TYPE"
      ) {
        logCvUploadRejection({
          reason: "UNSUPPORTED_MEDIA_TYPE",
          byteSize: request.declaredBytes,
          declaredMimeType: request.declaredMediaType,
        });
      }
      throw error;
    }
    const uploadId = this.dependencies.newId();
    const now = this.dependencies.now();
    const expiresAt = new Date(now.getTime() + 30 * 86_400_000);
    const binding = canonicalJson({
      filename,
      declaredMediaType: request.declaredMediaType,
      declaredBytes: request.declaredBytes,
      parserClass: request.parserClass,
    });
    const reservation = await this.dependencies.reserve({
      accountId: input.accountId,
      profileId,
      uploadId,
      documentKind: kind,
      parserClass: request.parserClass,
      declaredMediaType: request.declaredMediaType,
      declaredBytes: request.declaredBytes,
      idempotencyDigest: hmac(
        this.dependencies.idempotencySecret,
        "reservation-key",
        input.idempotencyKey,
      ),
      bindingDigest: hmac(
        this.dependencies.idempotencySecret,
        "reservation-binding",
        binding,
      ),
      displayFilenameCiphertext: this.dependencies.encryptDisplayFilename(
        filename,
        { accountId: input.accountId, uploadId },
      ),
      now,
      expiresAt,
    });
    const notice = cvProcessingNotice(request.parserClass);
    if (!reservation.replayed) {
      await this.dependencies.audit({
        accountId: input.accountId,
        uploadId: reservation.uploadId,
        parserClass: request.parserClass,
        noticeVersion: notice.noticeVersion,
        occurredAt: now,
      });
    }
    const response = cvUploadReservationSchema.parse({
      uploadId: reservation.uploadId,
      status: "AWAITING_CONTENT",
      contentUrl: `/api/account/cv-imports/${reservation.uploadId}/content`,
      expiresAt: reservation.expiresAt.toISOString(),
      limits: {
        maximumBytes: 5_000_000,
        requiredContentType: request.declaredMediaType,
        requiredContentLength: request.declaredBytes,
      },
    });
    return Object.freeze({
      reservation: response,
      processingNotice: notice,
      replayed: reservation.replayed,
    });
  }
}
