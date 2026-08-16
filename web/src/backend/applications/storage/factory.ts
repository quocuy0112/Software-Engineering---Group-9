import "server-only";

import { createCvWorkerStorage } from "@/backend/cv/workers/cv-worker-resources";
import { cvConfiguration } from "@/backend/cv/config";
import type { ApplicationDocumentStoragePort } from "./application-document-storage";
import { FilesystemApplicationDocumentStorage } from "./filesystem";
import { S3ApplicationDocumentStorage } from "./s3";

export function createApplicationDocumentStorage(): ApplicationDocumentStoragePort {
  const storage = createCvWorkerStorage();
  return cvConfiguration.storage.adapter === "filesystem"
    ? new FilesystemApplicationDocumentStorage(storage)
    : new S3ApplicationDocumentStorage(storage);
}
