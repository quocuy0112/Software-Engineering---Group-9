import "server-only";

import { prisma } from "@/backend/database/prisma";
import { SearchIntentSelectionPolicy } from "@/backend/image-search/interpretation/selection-policy";
import { readSearchArtifact } from "@/backend/image-search/storage/artifact-io";
import { readSearchArtifactEnvelope } from "@/backend/image-search/storage/prisma-artifact-envelope";
import type { SearchStorageResource } from "@/backend/image-search/storage/factory";
import type { ImageSearchActor } from "@/backend/security/image-search-request-boundary";
import { PrismaImageSearchQueryRepository } from "@/backend/repositories/image-search/prisma-image-search-query-repository";
import {
  consumeImageSearchResultRequestSchema,
  imageSearchResultSchema,
} from "@/shared/contracts/jobs/image-search";
import { searchIntentSchema } from "@/shared/contracts/jobs/search-intent";
import { ImageSearchServiceError } from "./image-search-errors";
import { appendImageSearchAudit } from "@/backend/repositories/audit/prisma-audit-repository";

type OcrPayload = Readonly<{
  schemaVersion: "search-ocr-text-v1";
  text: string;
  language: "VI" | "EN" | "BILINGUAL" | "UNKNOWN";
  warnings: readonly ("LOW_CONFIDENCE" | "PARTIAL_OCR")[];
}>;

export class ConsumeImageSearchResultService {
  constructor(
    private readonly dependencies: Readonly<{
      repository: PrismaImageSearchQueryRepository;
      storage: SearchStorageResource;
      capabilityHmacKey: Uint8Array;
      selectionPolicy: SearchIntentSelectionPolicy;
      now(): Date;
    }>,
  ) {}

  async execute(input: {
    queryId: string;
    actor: ImageSearchActor;
    visitorCapability: string | null;
    body: unknown;
  }) {
    const request = consumeImageSearchResultRequestSchema.safeParse(input.body);
    if (!request.success)
      throw new ImageSearchServiceError(
        400,
        "VALIDATION_ERROR",
        "Review the current visible search criteria.",
        null,
        request.error.issues.slice(0, 20).map((issue) => ({
          path: issue.path.join(".") || "request",
          code: issue.code,
          message: issue.message,
        })),
      );
    const now = this.dependencies.now();
    const query = await this.dependencies.repository
      .authorize({
        queryId: input.queryId,
        actor: input.actor,
        visitorCapability: input.visitorCapability,
        capabilityHmacKey: this.dependencies.capabilityHmacKey,
        now,
        allowInaccessible: true,
      })
      .catch((error) => {
        if ((error as Error).message === "QUERY_EXPIRED")
          throw new ImageSearchServiceError(
            409,
            "QUERY_EXPIRED",
            "The image-search result has expired.",
          );
        throw new ImageSearchServiceError(
          404,
          "IMAGE_SEARCH_NOT_FOUND",
          "Image search was not found.",
        );
      });
    if (query.status === "CONSUMED")
      throw new ImageSearchServiceError(
        409,
        "RESULT_ALREADY_CONSUMED",
        "The image-search result was already consumed.",
      );
    if (!["RESULT_READY", "FALLBACK_READY"].includes(query.status))
      throw new ImageSearchServiceError(
        409,
        "RESULT_NOT_READY",
        "The image-search result is not ready.",
      );
    const kind =
      query.resultKind === "VALIDATED_INTENT" ? "VALIDATED_INTENT" : "OCR_TEXT";
    const artifact = await prisma.searchStoredArtifact.findFirst({
      where: { queryId: query.id, kind, status: "AVAILABLE" },
      select: {
        id: true,
        storageLocator: true,
        plaintextBytes: true,
      },
    });
    if (!artifact)
      throw new ImageSearchServiceError(
        409,
        "RESULT_NOT_READY",
        "The image-search result is not ready.",
      );
    const envelope = await readSearchArtifactEnvelope(artifact.id);
    if (!envelope)
      throw new ImageSearchServiceError(
        409,
        "RESULT_NOT_READY",
        "The image-search result is not ready.",
      );
    const bytes = await readSearchArtifact({
      storage: this.dependencies.storage.storage,
      locator: artifact.storageLocator,
      authenticationTag: envelope.authenticationTag,
      context: {
        queryId: query.id,
        artifactId: artifact.id,
        kind,
      },
      expectedBytes: artifact.plaintextBytes,
      expectedSha256: envelope.plaintextSha256,
      maximumBytes: kind === "OCR_TEXT" ? 32 * 1024 : 64 * 1024,
    });
    const result =
      kind === "VALIDATED_INTENT"
        ? {
            kind: "VALIDATED_INTENT" as const,
            queryId: query.id,
            intent: this.dependencies.selectionPolicy.mergeForDelivery({
              intent: searchIntentSchema.parse(
                JSON.parse(bytes.toString("utf8")),
              ),
              currentCriteria: request.data.currentCriteria,
            }),
          }
        : (() => {
            const payload = JSON.parse(bytes.toString("utf8")) as OcrPayload;
            if (
              payload.schemaVersion !== "search-ocr-text-v1" ||
              !payload.text ||
              !["VI", "EN", "BILINGUAL", "UNKNOWN"].includes(payload.language)
            )
              throw new ImageSearchServiceError(
                409,
                "RESULT_NOT_READY",
                "The image-search fallback is unavailable.",
              );
            return {
              kind: "OCR_TEXT_FALLBACK" as const,
              queryId: query.id,
              text: payload.text,
              language: payload.language,
              warnings: [
                ...payload.warnings,
                query.failureCode === "INTERPRETER_INVALID_OUTPUT"
                  ? ("INTERPRETER_INVALID_OUTPUT" as const)
                  : query.failureCode === "INTERPRETER_UNAVAILABLE"
                    ? ("INTERPRETER_UNAVAILABLE" as const)
                    : undefined,
              ].filter((value): value is NonNullable<typeof value> =>
                Boolean(value),
              ),
            };
          })();
    await prisma.$transaction(async (transaction) => {
      const committed = await transaction.searchImageQuery.updateMany({
        where: {
          id: query.id,
          status: query.status as "RESULT_READY" | "FALLBACK_READY",
          contentInaccessibleAt: null,
          deleteBy: { gt: now },
        },
        data: {
          status: "CONSUMED",
          resultConsumedAt: now,
          contentInaccessibleAt: now,
        },
      });
      if (committed.count !== 1)
        throw new ImageSearchServiceError(
          409,
          "RESULT_ALREADY_CONSUMED",
          "The image-search result is no longer available.",
        );
      await transaction.searchStoredArtifact.updateMany({
        where: { queryId: query.id, status: { not: "DELETED" } },
        data: {
          status: "DELETE_PENDING",
          contentInaccessibleAt: now,
          deleteAfter: now,
          deleteLeaseOwner: null,
          deleteLeaseExpiresAt: null,
        },
      });
    });
    await appendImageSearchAudit({
      action: "image_search.consumed",
      queryId: query.id,
      actorClass: query.actorClass,
      accountId: query.accountId,
      result: "SUCCESS",
      occurredAt: now,
      context: {
        kind: result.kind,
        count:
          result.kind === "VALIDATED_INTENT"
            ? result.intent.proposals.length
            : undefined,
      },
    }).catch(() => undefined);
    return imageSearchResultSchema.parse(result);
  }
}
