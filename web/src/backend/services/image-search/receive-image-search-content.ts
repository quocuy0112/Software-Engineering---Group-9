import "server-only";

import { randomUUID } from "node:crypto";

import type { SearchStorageResource } from "@/backend/image-search/storage/factory";
import type { ImageSearchActor } from "@/backend/security/image-search-request-boundary";
import { PrismaImageSearchQueryRepository } from "@/backend/repositories/image-search/prisma-image-search-query-repository";
import { ImageSearchServiceError } from "./image-search-errors";

function validLeadingSignature(mediaType: string, bytes: Uint8Array) {
  const prefix = Buffer.from(bytes);
  return mediaType === "image/png"
    ? prefix.byteLength >= 8 &&
        prefix.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
    : prefix.byteLength >= 3 &&
        prefix[0] === 0xff &&
        prefix[1] === 0xd8 &&
        prefix[2] === 0xff;
}

async function* inspectLeadingSignature(input: {
  source: AsyncIterable<Uint8Array>;
  mediaType: string;
  maximumBytes: number;
}) {
  let total = 0;
  let prefix = Buffer.alloc(0);
  let checked = false;
  for await (const chunkValue of input.source) {
    const chunk = Buffer.from(chunkValue);
    total += chunk.byteLength;
    if (total > input.maximumBytes)
      throw new ImageSearchServiceError(
        413,
        "PAYLOAD_TOO_LARGE",
        "The image exceeds the declared size.",
      );
    if (!checked) {
      prefix = Buffer.concat([
        prefix,
        chunk.subarray(0, Math.max(0, 12 - prefix.length)),
      ]);
      if (prefix.length >= 8 || total === input.maximumBytes) {
        checked = true;
        if (!validLeadingSignature(input.mediaType, prefix))
          throw new ImageSearchServiceError(
            415,
            "UNSUPPORTED_MEDIA_TYPE",
            "Upload a matching static PNG or JPEG image.",
          );
      }
    }
    yield chunk;
  }
  if (!checked && !validLeadingSignature(input.mediaType, prefix))
    throw new ImageSearchServiceError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Upload a matching static PNG or JPEG image.",
    );
}

export class ReceiveImageSearchContentService {
  constructor(
    private readonly dependencies: Readonly<{
      repository: PrismaImageSearchQueryRepository;
      storage: SearchStorageResource;
      capabilityHmacKey: Uint8Array;
      now(): Date;
    }>,
  ) {}

  async execute(input: {
    queryId: string;
    actor: ImageSearchActor;
    visitorCapability: string | null;
    contentType: string | null;
    contentLength: number | null;
    source: AsyncIterable<Uint8Array>;
  }) {
    const now = this.dependencies.now();
    const query = await this.dependencies.repository
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
    if (query.status === "SCAN_QUEUED") return { replay: true } as const;
    if (query.status !== "AWAITING_CONTENT")
      throw new ImageSearchServiceError(
        409,
        "QUERY_STATE_CONFLICT",
        "The query is not waiting for image content.",
      );
    if (
      input.contentLength !== query.declaredBytes ||
      input.contentType !== query.declaredMediaType
    )
      throw new ImageSearchServiceError(
        400,
        "VALIDATION_ERROR",
        "Content length and media type must match the reservation.",
      );
    const artifactId = randomUUID();
    await this.dependencies.storage.storage.assertReady();
    const stored = await this.dependencies.storage.storage.put({
      source: inspectLeadingSignature({
        source: input.source,
        mediaType: query.declaredMediaType,
        maximumBytes: query.declaredBytes,
      }),
      expectedBytes: query.declaredBytes,
      context: { queryId: query.id, artifactId, kind: "SOURCE_IMAGE" },
    });
    try {
      return await this.dependencies.repository.attachSourceAndQueueScan({
        queryId: query.id,
        now,
        artifactId,
        adapter: this.dependencies.storage.adapterName,
        stored,
      });
    } catch (error) {
      await this.dependencies.storage.storage
        .delete(stored.locator)
        .catch(() => undefined);
      if ((error as Error).message === "QUERY_STATE_CONFLICT")
        throw new ImageSearchServiceError(
          409,
          "QUERY_STATE_CONFLICT",
          "The query state changed before upload completion.",
        );
      throw error;
    }
  }
}
