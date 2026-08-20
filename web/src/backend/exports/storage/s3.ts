import "server-only";

import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { openExport, sealExport } from "./crypto-envelope";
import { checksum } from "./crypto-envelope";
import type { ExportArtifact, ExportArtifactStorage } from "./export-artifact-storage";

function s3Settings() {
  const bucket = process.env.ANALYTICS_EXPORT_S3_BUCKET;
  const region = process.env.ANALYTICS_EXPORT_S3_REGION ?? process.env.AWS_REGION;
  if (!bucket || !region) throw new Error("ANALYTICS_EXPORT_S3_NOT_CONFIGURED");
  return {
    bucket,
    prefix: process.env.ANALYTICS_EXPORT_S3_PREFIX ?? "private/analytics-exports",
    client: new S3Client({ region }),
  };
}

export class S3ExportArtifactStorage implements ExportArtifactStorage {
  async put(exportId: string, content: Buffer): Promise<ExportArtifact> {
    const settings = s3Settings();
    const locator = exportId + "-" + randomUUID();
    const key = settings.prefix + "/" + locator + ".bin";
    await settings.client.send(
      new PutObjectCommand({
        Bucket: settings.bucket,
        Key: key,
        Body: sealExport(content),
        ContentType: "application/octet-stream",
        ServerSideEncryption: "AES256",
      }),
    );
    return { locator, checksum: checksum(content), byteCount: content.byteLength };
  }

  async get(locator: string) {
    const settings = s3Settings();
    const response = await settings.client.send(
      new GetObjectCommand({
        Bucket: settings.bucket,
        Key: settings.prefix + "/" + locator + ".bin",
      }),
    );
    if (!response.Body) throw new Error("EXPORT_ARTIFACT_NOT_FOUND");
    return openExport(Buffer.from(await response.Body.transformToByteArray()));
  }

  async delete(locator: string) {
    const settings = s3Settings();
    await settings.client.send(
      new DeleteObjectCommand({
        Bucket: settings.bucket,
        Key: settings.prefix + "/" + locator + ".bin",
      }),
    );
  }
}
