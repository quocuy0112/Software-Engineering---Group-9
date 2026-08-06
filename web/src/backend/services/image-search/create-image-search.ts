import "server-only";

import { createHash, createHmac } from "node:crypto";

import { PrismaImageSearchAdmissionRepository } from "@/backend/repositories/image-search/prisma-image-search-admission-repository";
import type { ImageSearchActor } from "@/backend/security/image-search-request-boundary";
import { imageSearchIdempotencyDigest } from "@/backend/security/image-search-request-boundary";
import {
  createImageSearchRequestSchema,
  createImageSearchResponseSchema,
} from "@/shared/contracts/jobs/image-search";
import type { AdmissionReadinessPort } from "@/backend/image-search/workers/resources";
import { ImageSearchServiceError } from "./image-search-errors";
import { appendImageSearchAudit } from "@/backend/repositories/audit/prisma-audit-repository";
import { loadImageSearchConfiguration } from "@/backend/image-search/config";

type Dependencies = Readonly<{
  admission: PrismaImageSearchAdmissionRepository;
  readiness: AdmissionReadinessPort;
  rateHmacKey: Uint8Array;
  capabilityHmacKey: Uint8Array;
  now(): Date;
  admissionEnabled?(): boolean;
}>;

type CreateImageSearchInput = Readonly<{
  actor: ImageSearchActor;
  sourceIpDigest: Uint8Array;
  idempotencyKey: string;
  body: unknown;
}>;

function hmac(key: Uint8Array, label: string, value: Uint8Array | string) {
  return createHmac("sha256", key).update(label, "utf8").update(value).digest();
}

function bindingBytes(value: unknown) {
  return Buffer.from(
    JSON.stringify(value, (_key, nested) => {
      if (nested && typeof nested === "object" && !Array.isArray(nested))
        return Object.fromEntries(
          Object.entries(nested as Record<string, unknown>).sort(([a], [b]) =>
            a.localeCompare(b),
          ),
        );
      return nested;
    }),
    "utf8",
  );
}

export class CreateImageSearchService {
  constructor(private readonly dependencies: Dependencies) {}

  private async run(input: CreateImageSearchInput) {
    const parsed = createImageSearchRequestSchema.safeParse(input.body);
    if (!parsed.success)
      throw new ImageSearchServiceError(
        400,
        "VALIDATION_ERROR",
        "Review the image-search metadata.",
        null,
        parsed.error.issues.slice(0, 20).map((issue) => ({
          path: issue.path.join(".") || "request",
          code: issue.code,
          message: issue.message,
        })),
      );
    let configuration: ReturnType<typeof loadImageSearchConfiguration> | null =
      null;
    try {
      const enabled =
        this.dependencies.admissionEnabled?.() ??
        (configuration = loadImageSearchConfiguration(process.env))
          .workerEnabled;
      if (!enabled) throw new Error("IMAGE_SEARCH_ADMISSION_DISABLED");
    } catch {
      throw new ImageSearchServiceError(
        503,
        "IMAGE_PROCESSING_UNAVAILABLE",
        "Image search is unavailable; ordinary job search remains available.",
      );
    }
    if (parsed.data.interpreterClass === "EXTERNAL_OPENAI") {
      try {
        configuration ??= loadImageSearchConfiguration(process.env);
        if (configuration.interpreter.class !== "EXTERNAL_OPENAI")
          throw new Error();
      } catch {
        throw new ImageSearchServiceError(
          503,
          "IMAGE_PROCESSING_UNAVAILABLE",
          "External interpretation is unavailable; choose internal or manual search.",
        );
      }
    }
    try {
      await this.dependencies.readiness.assertAdmissionReady(
        this.dependencies.now(),
      );
    } catch {
      throw new ImageSearchServiceError(
        503,
        "IMAGE_PROCESSING_UNAVAILABLE",
        "Image search is temporarily unavailable; ordinary job search remains available.",
      );
    }

    const now = this.dependencies.now();
    const actorBinding =
      input.actor.kind === "AUTHENTICATED"
        ? hmac(
            this.dependencies.rateHmacKey,
            "image-search-account-v1:",
            input.actor.accountId,
          )
        : Buffer.from(input.actor.browserSubjectDigest);
    const idempotencyDigest = imageSearchIdempotencyDigest({
      actorBinding,
      idempotencyKey: input.idempotencyKey,
      hmacKey: this.dependencies.rateHmacKey,
    });
    const capability =
      input.actor.kind === "VISITOR"
        ? createHmac("sha256", this.dependencies.capabilityHmacKey)
            .update("image-search-capability-issue-v1", "utf8")
            .update(actorBinding)
            .update(idempotencyDigest)
            .digest("base64url")
        : null;
    const bindingDigest = createHash("sha256")
      .update("image-search-create-binding-v1", "utf8")
      .update(actorBinding)
      .update(bindingBytes(parsed.data))
      .digest();

    let result;
    try {
      result = await this.dependencies.admission.admit({
        actor:
          input.actor.kind === "AUTHENTICATED"
            ? {
                kind: "AUTHENTICATED",
                accountId: input.actor.accountId,
                accountDigest: actorBinding,
              }
            : {
                kind: "VISITOR",
                browserDigest: input.actor.browserSubjectDigest,
                sourceIpDigest: input.sourceIpDigest,
                capability: capability!,
                capabilityHmacKey: this.dependencies.capabilityHmacKey,
                capabilityKeyVersion: 1,
              },
        metadata: parsed.data,
        idempotencyDigest,
        bindingDigest,
        now,
      });
    } catch (error) {
      if ((error as Error).message === "IMAGE_SEARCH_IDEMPOTENCY_KEY_REUSED")
        throw new ImageSearchServiceError(
          409,
          "IDEMPOTENCY_KEY_REUSED",
          "The idempotency key was already used for different metadata.",
        );
      throw error;
    }
    if (result.kind === "LIMITED")
      throw new ImageSearchServiceError(
        429,
        "IMAGE_QUERY_RATE_LIMITED",
        "The image-search limit has been reached. Try again later.",
        result.retryAt,
      );

    if (!result.replay)
      await appendImageSearchAudit({
        action: "image_search.admitted",
        queryId: result.query.id,
        actorClass: result.query.actorClass,
        accountId:
          input.actor.kind === "AUTHENTICATED" ? input.actor.accountId : null,
        result: "SUCCESS",
        occurredAt: now,
        context: {
          status: "AWAITING_CONTENT",
          consentPresent: Boolean(parsed.data.consent),
          modelVersion: parsed.data.consent?.model,
          schemaVersion: "job-search-intent-v1",
        },
      }).catch(() => undefined);

    const outcome = createImageSearchResponseSchema.parse({
      queryId: result.query.id,
      actorClass: result.query.actorClass,
      capability,
      status: "AWAITING_CONTENT",
      admittedAt: result.query.admittedAt.toISOString(),
      expiresAt: result.query.expiresAt.toISOString(),
      upload: {
        method: "PUT",
        path: `/api/jobs/image-searches/${result.query.id}/content`,
        mediaType: parsed.data.mediaType,
        bytes: parsed.data.bytes,
      },
    });
    return { outcome, replayed: result.replay } as const;
  }

  async execute(input: CreateImageSearchInput) {
    return (await this.run(input)).outcome;
  }

  async executeForHttp(input: CreateImageSearchInput) {
    return this.run(input);
  }
}
