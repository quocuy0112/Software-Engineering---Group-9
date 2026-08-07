import "server-only";

import { createHmac, randomUUID } from "node:crypto";

import { prisma } from "@/backend/database/prisma";
import { PrismaImageSearchQueryRepository } from "@/backend/repositories/image-search/prisma-image-search-query-repository";
import { PrismaSearchConsentRepository } from "@/backend/repositories/image-search/prisma-search-consent-repository";
import type { ImageSearchActor } from "@/backend/security/image-search-request-boundary";
import {
  searchConsentRequestSchema,
  searchConsentResponseSchema,
} from "@/shared/contracts/jobs/image-search";
import { ImageSearchServiceError } from "./image-search-errors";
import { appendImageSearchAudit } from "@/backend/repositories/audit/prisma-audit-repository";

export class UpdateImageSearchConsentService {
  constructor(
    private readonly dependencies: Readonly<{
      queries: PrismaImageSearchQueryRepository;
      consents: PrismaSearchConsentRepository;
      capabilityHmacKey: Uint8Array;
      now(): Date;
    }>,
  ) {}

  async execute(input: {
    queryId: string;
    actor: ImageSearchActor;
    visitorCapability: string | null;
    idempotencyKey: string;
    body: unknown;
  }) {
    const decision = searchConsentRequestSchema.safeParse(input.body);
    if (!decision.success)
      throw new ImageSearchServiceError(
        400,
        "VALIDATION_ERROR",
        "Choose whether to allow external text interpretation.",
      );
    const now = this.dependencies.now();
    const query = await this.dependencies.queries
      .authorize({
        queryId: input.queryId,
        actor: input.actor,
        visitorCapability: input.visitorCapability,
        capabilityHmacKey: this.dependencies.capabilityHmacKey,
        now,
      })
      .catch(() => {
        throw new ImageSearchServiceError(
          404,
          "IMAGE_SEARCH_NOT_FOUND",
          "Image search was not found.",
        );
      });
    if (query.interpreterClass !== "EXTERNAL_OPENAI")
      throw new ImageSearchServiceError(
        409,
        "QUERY_STATE_CONFLICT",
        "This query uses internal interpretation and does not need consent.",
      );
    const event = await this.dependencies.consents
      .append({
        queryId: query.id,
        accountId: query.accountId,
        actorClass: query.actorClass,
        decision: decision.data,
        idempotencyDigest: createHmac(
          "sha256",
          this.dependencies.capabilityHmacKey,
        )
          .update("image-search-consent-idempotency-v1", "utf8")
          .update(query.id, "utf8")
          .update(input.idempotencyKey, "utf8")
          .digest(),
        now,
      })
      .catch((error) => {
        if ((error as Error).message === "IMAGE_SEARCH_IDEMPOTENCY_KEY_REUSED")
          throw new ImageSearchServiceError(
            409,
            "IDEMPOTENCY_KEY_REUSED",
            "The idempotency key was already used for a different consent decision.",
          );
        throw error;
      });
    let state = query.status;
    if (decision.data.action === "REVOKED") {
      const result = await prisma.$transaction(async (transaction) => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${query.id}, 0))`;
        const latest = await transaction.searchProcessingConsent.findFirst({
          where: { queryId: query.id },
          orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
          select: { id: true, action: true },
        });
        if (latest?.id !== event.id || latest.action !== "REVOKED") {
          const current = await transaction.searchImageQuery.findUnique({
            where: { id: query.id },
            select: { status: true },
          });
          return current?.status ?? query.status;
        }
        await transaction.searchIntentAttempt.updateMany({
          where: {
            queryId: query.id,
            status: { in: ["QUEUED", "PROCESSING"] },
          },
          data: {
            status: "CANCELLED",
            completedAt: now,
            leaseOwner: null,
            leaseExpiresAt: null,
          },
        });
        const updated = await transaction.searchImageQuery.updateMany({
          where: {
            id: query.id,
            status: {
              in: ["AWAITING_CONSENT", "INTERPRET_QUEUED", "INTERPRETING"],
            },
            contentInaccessibleAt: null,
            deleteBy: { gt: now },
          },
          data: {
            status: "FALLBACK_READY",
            resultKind: "OCR_TEXT_FALLBACK",
            resultReadyAt: now,
            failureCode: "CONSENT_REQUIRED",
          },
        });
        return updated.count ? "FALLBACK_READY" : query.status;
      });
      state = result;
    } else if (query.status === "AWAITING_CONSENT") {
      const grant = decision.data.grant;
      const queued = await prisma.$transaction(async (transaction) => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${query.id}, 0))`;
        const latest = await transaction.searchProcessingConsent.findFirst({
          where: { queryId: query.id },
          orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
          select: { id: true, action: true },
        });
        if (latest?.id !== event.id || latest.action !== "GRANTED")
          return false;
        const current = await transaction.searchImageQuery.findUnique({
          where: { id: query.id },
          select: { status: true, contentInaccessibleAt: true, deleteBy: true },
        });
        if (
          current?.status !== "AWAITING_CONSENT" ||
          current.contentInaccessibleAt ||
          current.deleteBy <= now
        )
          return false;
        const ocr = await transaction.ocrProcessingAttempt.findUnique({
          where: { searchQueryId: query.id },
          select: {
            id: true,
            intentAttempt: { select: { id: true } },
          },
        });
        const text = await transaction.searchStoredArtifact.findUnique({
          where: { queryId_kind: { queryId: query.id, kind: "OCR_TEXT" } },
          select: { id: true },
        });
        if (!ocr || !text) throw new Error("CONSENT_INPUT_UNAVAILABLE");
        if (ocr.intentAttempt)
          await transaction.searchIntentAttempt.update({
            where: { id: ocr.intentAttempt.id },
            data: {
              consentEventId: event.id,
              status: "QUEUED",
              failureCode: null,
              leaseOwner: null,
              leaseExpiresAt: null,
              completedAt: null,
            },
          });
        else
          await transaction.searchIntentAttempt.create({
            data: {
              id: randomUUID(),
              queryId: query.id,
              ocrAttemptId: ocr.id,
              ocrTextArtifactId: text.id,
              consentEventId: event.id,
              attemptNumber: 1,
              status: "QUEUED",
              interpreterClass: "EXTERNAL_OPENAI",
              provider: "openai",
              model: grant.model,
              purposeVersion: grant.purposeVersion,
              inputVersion: "search-ocr-text-v1",
              instructionVersion: "job-search-intent-v2",
              schemaVersion: "job-search-intent-v1",
              selectionPolicyVersion: "search-intent-selection-v2",
            },
          });
        await transaction.searchImageQuery.update({
          where: { id: query.id },
          data: { status: "INTERPRET_QUEUED", failureCode: null },
          select: { id: true },
        });
        return true;
      });
      state = queued
        ? "INTERPRET_QUEUED"
        : ((await this.dependencies.queries.currentStatus(query.id))?.status ??
          query.status);
    }
    if (!event.replayed)
      await appendImageSearchAudit({
        action:
          event.action === "GRANTED"
            ? "image_search.consent_granted"
            : "image_search.consent_revoked",
        queryId: query.id,
        actorClass: query.actorClass,
        accountId: query.accountId,
        result: "SUCCESS",
        occurredAt: now,
        context: {
          consentPresent: event.action === "GRANTED",
          consentRevoked: event.action === "REVOKED",
          noticeVersion:
            decision.data.action === "GRANTED"
              ? decision.data.grant.noticeVersion
              : "image-search-notice-v1",
        },
      }).catch(() => undefined);
    return searchConsentResponseSchema.parse({
      action: event.action,
      occurredAt: event.occurredAt.toISOString(),
      state,
    });
  }
}
