import "server-only";

import { createHmac } from "node:crypto";

import { createSearchStorageResource } from "@/backend/image-search/storage/factory";
import { PrismaImageSearchAdmissionRepository } from "@/backend/repositories/image-search/prisma-image-search-admission-repository";
import { PrismaImageSearchQueryRepository } from "@/backend/repositories/image-search/prisma-image-search-query-repository";
import { CancelImageSearchService } from "./cancel-image-search";
import { CreateImageSearchService } from "./create-image-search";
import { GetImageSearchStatusService } from "./get-image-search-status";
import { ImageSearchAdmissionReadiness } from "./image-search-admission-readiness";
import { ReceiveImageSearchContentService } from "./receive-image-search-content";
import { ConsumeImageSearchResultService } from "./consume-image-search-result";
import { SearchIntentSelectionPolicy } from "@/backend/image-search/interpretation/selection-policy";
import { UpdateImageSearchConsentService } from "./update-image-search-consent";
import { PrismaSearchConsentRepository } from "@/backend/repositories/image-search/prisma-search-consent-repository";

function key(name: string) {
  const value = Buffer.from(process.env[name] ?? "", "base64");
  if (value.byteLength !== 32) throw new Error("IMAGE_SEARCH_KEY_UNAVAILABLE");
  return value;
}

export function createImageSearchRouteResources() {
  const rateHmacKey = key("IMAGE_SEARCH_RATE_HMAC_KEY_V1");
  const capabilityHmacKey = key("IMAGE_SEARCH_CAPABILITY_HMAC_KEY_V1");
  const repository = new PrismaImageSearchQueryRepository();
  const now = () => new Date();
  const readiness = new ImageSearchAdmissionReadiness({
    production: process.env.APP_ENV === "production",
    preflightReportPath: process.env.IMAGE_SEARCH_STORAGE_PREFLIGHT_REPORT,
  });
  return {
    rateHmacKey,
    capabilityHmacKey,
    sourceIpDigest(request: Request) {
      const forwarded = request.headers
        .get("x-forwarded-for")
        ?.split(",")[0]
        ?.trim();
      const source =
        forwarded || request.headers.get("x-real-ip") || "local-unknown";
      return createHmac("sha256", rateHmacKey)
        .update(`image-search-source-ip-v1:${source}`, "utf8")
        .digest();
    },
    create: new CreateImageSearchService({
      admission: new PrismaImageSearchAdmissionRepository(),
      readiness,
      rateHmacKey,
      capabilityHmacKey,
      now,
    }),
    receive: new ReceiveImageSearchContentService({
      repository,
      storage: createSearchStorageResource(),
      capabilityHmacKey,
      now,
    }),
    status: new GetImageSearchStatusService({
      repository,
      capabilityHmacKey,
      now,
    }),
    cancel: new CancelImageSearchService({
      repository,
      capabilityHmacKey,
      now,
    }),
    consume: new ConsumeImageSearchResultService({
      repository,
      storage: createSearchStorageResource(),
      capabilityHmacKey,
      selectionPolicy: new SearchIntentSelectionPolicy(),
      now,
    }),
    consent: new UpdateImageSearchConsentService({
      queries: repository,
      consents: new PrismaSearchConsentRepository(),
      capabilityHmacKey,
      now,
    }),
  };
}
