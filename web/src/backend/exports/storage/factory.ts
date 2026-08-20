import "server-only";

import type { ExportArtifactStorage } from "./export-artifact-storage";
import { FilesystemExportArtifactStorage } from "./filesystem";
import { S3ExportArtifactStorage } from "./s3";

let storage: ExportArtifactStorage | undefined;

export function exportArtifactStorage() {
  if (!storage) {
    storage =
      process.env.ANALYTICS_EXPORT_STORAGE_PROVIDER === "s3"
        ? new S3ExportArtifactStorage()
        : new FilesystemExportArtifactStorage();
  }
  return storage;
}
