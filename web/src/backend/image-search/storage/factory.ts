import "server-only";

import { S3Client } from "@aws-sdk/client-s3";

import { FilesystemPrivateSearchArtifactStorage } from "./filesystem";
import type { PrivateSearchArtifactStorage } from "./private-search-storage";
import { S3PrivateSearchArtifactStorage } from "./s3";

export type SearchStorageResource = Readonly<{
  adapterName: "filesystem" | "s3";
  storage: PrivateSearchArtifactStorage;
}>;

export function createSearchStorageResource(
  environment: NodeJS.ProcessEnv = process.env,
): SearchStorageResource {
  const key = Buffer.from(
    environment.IMAGE_SEARCH_ARTIFACT_KEY_V1 ?? "",
    "base64",
  );
  if (key.byteLength !== 32) throw new Error("IMAGE_SEARCH_KEY_UNAVAILABLE");
  const keyring = {
    activeKeyVersion: 1,
    keys: new Map([[1, key]]),
  };
  if (environment.IMAGE_SEARCH_STORAGE_ADAPTER === "s3") {
    const region = environment.IMAGE_SEARCH_S3_REGION ?? "";
    return {
      adapterName: "s3",
      storage: new S3PrivateSearchArtifactStorage({
        client: new S3Client({ region }),
        bucket: environment.IMAGE_SEARCH_S3_BUCKET ?? "",
        region,
        prefix: environment.IMAGE_SEARCH_S3_PREFIX ?? "image-search/",
        kmsKeyId: environment.IMAGE_SEARCH_S3_KMS_KEY_ID ?? "",
        keyring,
      }),
    };
  }
  const root = environment.IMAGE_SEARCH_STORAGE_LOCAL_ROOT ?? "";
  return {
    adapterName: "filesystem",
    storage: new FilesystemPrivateSearchArtifactStorage({ root, keyring }),
  };
}
