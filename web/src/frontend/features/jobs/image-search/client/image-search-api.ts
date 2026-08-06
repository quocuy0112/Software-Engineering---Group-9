import type {
  CreateImageSearchRequest,
  ImageSearchResult,
  ManualSearchContext,
} from "@/shared/contracts/jobs/image-search";
import {
  createImageSearchResponseSchema,
  imageSearchResultSchema,
  imageSearchStatusResponseSchema,
} from "@/shared/contracts/jobs/image-search";
import { mutateWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";

export const imageSearchStatusQueryDefaults = Object.freeze({
  staleTime: 0,
  gcTime: 0,
  retry: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  networkMode: "always" as const,
});

function headers(input: {
  idempotencyKey?: string;
  capability?: string | null;
  contentType?: string;
}) {
  const value = new Headers();
  if (input.idempotencyKey) value.set("idempotency-key", input.idempotencyKey);
  if (input.capability)
    value.set("x-image-search-capability", input.capability);
  if (input.contentType) value.set("content-type", input.contentType);
  return value;
}

async function bodyOrError(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const safe = body as {
      error?: { code?: string; message?: string; retryAt?: string | null };
    };
    throw Object.assign(
      new Error(safe.error?.message ?? "Image search could not continue."),
      {
        code: safe.error?.code ?? "IMAGE_PROCESSING_UNAVAILABLE",
        retryAt: safe.error?.retryAt ?? null,
      },
    );
  }
  return body;
}

export async function reserveImageSearch(input: {
  request: CreateImageSearchRequest;
  idempotencyKey: string;
  csrfProof: string;
  signal: AbortSignal;
}) {
  const response = await mutateWithCurrentCsrf(
    "/api/jobs/image-searches",
    {
      method: "POST",
      headers: headers({
        idempotencyKey: input.idempotencyKey,
        contentType: "application/json",
      }),
      body: JSON.stringify(input.request),
      cache: "no-store",
      signal: input.signal,
    },
    input.csrfProof,
  );
  return createImageSearchResponseSchema.parse(await bodyOrError(response));
}

export async function uploadImageSearchContent(input: {
  queryId: string;
  capability: string | null;
  file: File;
  idempotencyKey: string;
  csrfProof: string;
  signal: AbortSignal;
}) {
  const response = await mutateWithCurrentCsrf(
    `/api/jobs/image-searches/${input.queryId}/content`,
    {
      method: "PUT",
      headers: headers({
        idempotencyKey: input.idempotencyKey,
        capability: input.capability,
        contentType: input.file.type,
      }),
      body: input.file,
      cache: "no-store",
      signal: input.signal,
    },
    input.csrfProof,
  );
  if (!response.ok) await bodyOrError(response);
}

export async function getImageSearchStatus(input: {
  queryId: string;
  capability: string | null;
  signal: AbortSignal;
}) {
  const response = await fetch(`/api/jobs/image-searches/${input.queryId}`, {
    headers: headers({ capability: input.capability }),
    cache: "no-store",
    signal: input.signal,
  });
  return imageSearchStatusResponseSchema.parse(await bodyOrError(response));
}

export async function consumeImageSearchResult(input: {
  queryId: string;
  capability: string | null;
  currentCriteria: ManualSearchContext;
  idempotencyKey: string;
  csrfProof: string;
  signal: AbortSignal;
}): Promise<ImageSearchResult> {
  const response = await mutateWithCurrentCsrf(
    `/api/jobs/image-searches/${input.queryId}/result`,
    {
      method: "POST",
      headers: headers({
        idempotencyKey: input.idempotencyKey,
        capability: input.capability,
        contentType: "application/json",
      }),
      body: JSON.stringify({ currentCriteria: input.currentCriteria }),
      cache: "no-store",
      signal: input.signal,
    },
    input.csrfProof,
  );
  return imageSearchResultSchema.parse(await bodyOrError(response));
}

export async function cancelImageSearch(input: {
  queryId: string;
  capability: string | null;
  idempotencyKey: string;
  csrfProof: string;
  signal?: AbortSignal;
}) {
  const response = await mutateWithCurrentCsrf(
    `/api/jobs/image-searches/${input.queryId}`,
    {
      method: "DELETE",
      headers: headers({
        idempotencyKey: input.idempotencyKey,
        capability: input.capability,
      }),
      cache: "no-store",
      keepalive: true,
      signal: input.signal,
    },
    input.csrfProof,
  );
  if (!response.ok) await bodyOrError(response);
}

export async function revokeImageSearchConsent(input: {
  queryId: string;
  capability: string | null;
  idempotencyKey: string;
  csrfProof: string;
}) {
  const response = await mutateWithCurrentCsrf(
    `/api/jobs/image-searches/${input.queryId}/consent`,
    {
      method: "POST",
      headers: headers({
        idempotencyKey: input.idempotencyKey,
        capability: input.capability,
        contentType: "application/json",
      }),
      body: JSON.stringify({ action: "REVOKED", grant: null }),
      cache: "no-store",
    },
    input.csrfProof,
  );
  if (!response.ok) await bodyOrError(response);
}
