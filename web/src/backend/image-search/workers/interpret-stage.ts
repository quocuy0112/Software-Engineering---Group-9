import "server-only";

import { randomUUID } from "node:crypto";
import { createHmac } from "node:crypto";

import { prisma } from "@/backend/database/prisma";
import {
  readSearchArtifact,
  oneChunk,
} from "@/backend/image-search/storage/artifact-io";
import { readSearchArtifactEnvelope } from "@/backend/image-search/storage/prisma-artifact-envelope";
import type { SearchStorageResource } from "@/backend/image-search/storage/factory";
import type { SearchArtifactLocator } from "@/backend/image-search/storage/private-search-storage";
import {
  PrismaImageSearchWorkRepository,
  type ImageSearchWorkClaim,
} from "@/backend/repositories/image-search/prisma-image-search-work-repository";
import { CreateImageSearchFallbackService } from "@/backend/services/image-search/create-image-search-fallback";
import { ValidateSearchIntentService } from "@/backend/services/image-search/validate-search-intent";
import { loadImageSearchConfiguration } from "@/backend/image-search/config";
import {
  IMAGE_SEARCH_CONSENT_TEXT_VERSION,
  IMAGE_SEARCH_NOTICE_VERSION,
  IMAGE_SEARCH_OPENAI_MODEL,
  IMAGE_SEARCH_PURPOSE_VERSION,
  IMAGE_SEARCH_RETENTION_DISCLOSURE_VERSION,
} from "@/shared/contracts/jobs/image-search";

type StoredOcrText = Readonly<{
  schemaVersion: "search-ocr-text-v1";
  text: string;
  language: "VI" | "EN" | "BILINGUAL" | "UNKNOWN";
  warnings: readonly string[];
}>;

type ConsentSnapshot = Readonly<{
  id: string;
  action: "GRANTED" | "REVOKED";
  provider: string;
  interpreterClass: "DETERMINISTIC_INTERNAL" | "EXTERNAL_OPENAI";
  model: string;
  purposeVersion: string;
  noticeVersion: string;
  consentTextVersion: string;
  retentionDisclosureVersion: string;
}>;

function exactExternalConsent(
  consent: ConsentSnapshot | undefined | null,
  expectedId: string | null,
) {
  return Boolean(
    consent &&
    expectedId &&
    consent.id === expectedId &&
    consent.action === "GRANTED" &&
    consent.provider === "openai" &&
    consent.interpreterClass === "EXTERNAL_OPENAI" &&
    consent.model === IMAGE_SEARCH_OPENAI_MODEL &&
    consent.purposeVersion === IMAGE_SEARCH_PURPOSE_VERSION &&
    consent.noticeVersion === IMAGE_SEARCH_NOTICE_VERSION &&
    consent.consentTextVersion === IMAGE_SEARCH_CONSENT_TEXT_VERSION &&
    consent.retentionDisclosureVersion ===
      IMAGE_SEARCH_RETENTION_DISCLOSURE_VERSION,
  );
}

function parseOcrText(bytes: Uint8Array): StoredOcrText {
  const parsed = JSON.parse(
    Buffer.from(bytes).toString("utf8"),
  ) as StoredOcrText;
  if (
    parsed.schemaVersion !== "search-ocr-text-v1" ||
    typeof parsed.text !== "string" ||
    !parsed.text ||
    !["VI", "EN", "BILINGUAL", "UNKNOWN"].includes(parsed.language)
  )
    throw new Error("INTERPRETER_INVALID_OUTPUT");
  return parsed;
}

export class ImageSearchInterpretStage {
  constructor(
    private readonly dependencies: Readonly<{
      validators: Readonly<{
        deterministic: ValidateSearchIntentService | null;
        external: ValidateSearchIntentService | null;
      }>;
      storage: SearchStorageResource;
      work: PrismaImageSearchWorkRepository;
      fallback: CreateImageSearchFallbackService;
    }>,
  ) {}

  async process(claim: ImageSearchWorkClaim, now: Date, signal: AbortSignal) {
    const row = await prisma.searchIntentAttempt.findUnique({
      where: { id: claim.id },
      select: {
        id: true,
        queryId: true,
        interpreterClass: true,
        consentEventId: true,
        query: {
          select: {
            deleteBy: true,
            consentEvents: {
              orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
              take: 1,
              select: {
                id: true,
                action: true,
                provider: true,
                interpreterClass: true,
                model: true,
                purposeVersion: true,
                noticeVersion: true,
                consentTextVersion: true,
                retentionDisclosureVersion: true,
              },
            },
          },
        },
        ocrTextArtifact: {
          select: {
            id: true,
            kind: true,
            status: true,
            storageLocator: true,
            plaintextBytes: true,
          },
        },
      },
    });
    if (
      !row ||
      row.queryId !== claim.queryId ||
      row.ocrTextArtifact.kind !== "OCR_TEXT" ||
      row.ocrTextArtifact.status !== "AVAILABLE"
    )
      throw new Error("STAGE_RESULT_DISCARDED");
    const envelope = await readSearchArtifactEnvelope(row.ocrTextArtifact.id);
    if (!envelope) throw new Error("STAGE_RESULT_DISCARDED");
    if (row.interpreterClass === "EXTERNAL_OPENAI") {
      const externalConfigured = (() => {
        try {
          const configuration = loadImageSearchConfiguration(process.env);
          return (
            configuration.interpreter.class === "EXTERNAL_OPENAI" &&
            Boolean(configuration.interpreter.model)
          );
        } catch {
          return false;
        }
      })();
      if (!externalConfigured) {
        await this.dependencies.fallback.execute({
          queryId: row.queryId,
          intentAttemptId: row.id,
          now,
          failureCode: "INTERPRETER_UNAVAILABLE",
          leaseOwner: claim.leaseOwner,
        });
        return;
      }
      const latest = row.query.consentEvents[0];
      if (!exactExternalConsent(latest, row.consentEventId))
        throw new Error("STAGE_RESULT_DISCARDED");
    }
    let unattachedLocator: SearchArtifactLocator | null = null;
    try {
      const bytes = await readSearchArtifact({
        storage: this.dependencies.storage.storage,
        locator: row.ocrTextArtifact.storageLocator,
        authenticationTag: envelope.authenticationTag,
        context: {
          queryId: row.queryId,
          artifactId: row.ocrTextArtifact.id,
          kind: "OCR_TEXT",
        },
        expectedBytes: row.ocrTextArtifact.plaintextBytes,
        expectedSha256: envelope.plaintextSha256,
        maximumBytes: 32 * 1024,
      });
      const source = parseOcrText(bytes);
      const validator =
        row.interpreterClass === "EXTERNAL_OPENAI"
          ? this.dependencies.validators.external
          : this.dependencies.validators.deterministic;
      if (!validator) throw new Error("INTERPRETER_UNAVAILABLE");
      const interpretedIntent = await validator.execute({
        text: source.text,
        language: source.language,
        deadline: new Date(
          Math.min(Date.now() + 4_000, row.query.deleteBy.getTime()),
        ),
        signal,
        safetyIdentifier: createHmac(
          "sha256",
          Buffer.from(
            process.env.IMAGE_SEARCH_CAPABILITY_HMAC_KEY_V1 ?? "",
            "base64",
          ),
        )
          .update(`image-search-safety-v1:${row.queryId}`, "utf8")
          .digest("base64url"),
      });
      const intent = source.warnings.includes("PARTIAL_OCR")
        ? {
            ...interpretedIntent,
            warnings: [
              ...new Set([
                ...interpretedIntent.warnings,
                "PARTIAL_OCR_TEXT" as const,
              ]),
            ],
          }
        : interpretedIntent;
      const payload = Buffer.from(JSON.stringify(intent), "utf8");
      if (payload.byteLength > 64 * 1024)
        throw new Error("INTERPRETER_INVALID_OUTPUT");
      const commitNow = new Date();
      await this.dependencies.work.assertCommitAllowed({
        claim,
        now: commitNow,
      });
      const artifactId = randomUUID();
      const stored = await this.dependencies.storage.storage.put({
        source: oneChunk(payload),
        expectedBytes: payload.byteLength,
        context: {
          queryId: row.queryId,
          artifactId,
          kind: "VALIDATED_INTENT",
        },
      });
      unattachedLocator = stored.locator;
      await prisma.$transaction(async (transaction) => {
        const latest =
          row.interpreterClass === "EXTERNAL_OPENAI"
            ? await transaction.searchProcessingConsent.findFirst({
                where: { queryId: row.queryId },
                orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
                select: {
                  id: true,
                  action: true,
                  provider: true,
                  interpreterClass: true,
                  model: true,
                  purposeVersion: true,
                  noticeVersion: true,
                  consentTextVersion: true,
                  retentionDisclosureVersion: true,
                },
              })
            : null;
        if (
          row.interpreterClass === "EXTERNAL_OPENAI" &&
          !exactExternalConsent(latest, row.consentEventId)
        )
          throw new Error("STAGE_RESULT_DISCARDED");
        await transaction.searchStoredArtifact.create({
          data: {
            id: artifactId,
            queryId: row.queryId,
            kind: "VALIDATED_INTENT",
            status: "AVAILABLE",
            storageAdapter: this.dependencies.storage.adapterName,
            storageLocator: String(stored.locator),
            encryptionKeyVersion: stored.encryptionKeyVersion,
            encryptionIv: Buffer.from(stored.encryptionIv),
            authenticationTag: Buffer.from(stored.authenticationTag),
            plaintextBytes: stored.plaintextBytes,
            ciphertextBytes: stored.ciphertextBytes,
            plaintextSha256: Buffer.from(stored.plaintextSha256),
            availableAt: commitNow,
            deleteBy: row.query.deleteBy,
          },
          select: { id: true },
        });
        const committed = await transaction.searchIntentAttempt.updateMany({
          where: {
            id: claim.id,
            queryId: row.queryId,
            status: "PROCESSING",
            leaseOwner: claim.leaseOwner,
            leaseExpiresAt: { gt: commitNow },
            query: {
              status: "INTERPRETING",
              contentInaccessibleAt: null,
              deleteBy: { gt: commitNow },
            },
          },
          data: {
            status: "SUCCEEDED",
            resultArtifactId: artifactId,
            proposalCount: intent.proposals.length,
            autoSelectedCount: intent.proposals.filter((item) => item.selected)
              .length,
            suggestedCount: intent.proposals.filter((item) => !item.selected)
              .length,
            discardedCount: intent.warnings.length,
            completedAt: commitNow,
            leaseOwner: null,
            leaseExpiresAt: null,
          },
        });
        if (committed.count !== 1) throw new Error("STAGE_RESULT_DISCARDED");
        await transaction.searchImageQuery.update({
          where: { id: row.queryId },
          data: {
            status: "RESULT_READY",
            resultKind: "VALIDATED_INTENT",
            resultReadyAt: commitNow,
            failureCode: null,
          },
          select: { id: true },
        });
      });
      unattachedLocator = null;
    } catch (error) {
      if (unattachedLocator)
        await this.dependencies.storage.storage
          .delete(unattachedLocator)
          .catch(() => undefined);
      if ((error as Error).message === "STAGE_RESULT_DISCARDED") throw error;
      const failureCode =
        (error as Error).message === "INTERPRETER_INVALID_OUTPUT"
          ? "INTERPRETER_INVALID_OUTPUT"
          : "INTERPRETER_UNAVAILABLE";
      await this.dependencies.fallback.execute({
        queryId: row.queryId,
        intentAttemptId: row.id,
        now,
        failureCode,
        leaseOwner: claim.leaseOwner,
      });
    }
  }
}
