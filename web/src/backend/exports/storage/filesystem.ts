import "server-only";

import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { checksum, openExport, sealExport } from "./crypto-envelope";
import type { ExportArtifact, ExportArtifactStorage } from "./export-artifact-storage";

const locatorPattern = /^[a-f0-9-]{36}$/u;

export class FilesystemExportArtifactStorage implements ExportArtifactStorage {
  private readonly root =
    process.env.ANALYTICS_EXPORT_STORAGE_ROOT ??
    path.join(process.cwd(), ".local", "analytics-exports");

  private filePath(locator: string) {
    if (!locatorPattern.test(locator)) throw new Error("EXPORT_ARTIFACT_INVALID");
    return path.join(this.root, locator + ".bin");
  }

  async put(exportId: string, content: Buffer): Promise<ExportArtifact> {
    const locator = randomUUID();
    const destination = this.filePath(locator);
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const temporary = destination + "." + exportId + ".part";
    await writeFile(temporary, sealExport(content), { mode: 0o600 });
    await rename(temporary, destination);
    return { locator, checksum: checksum(content), byteCount: content.byteLength };
  }

  async get(locator: string) {
    return openExport(await readFile(this.filePath(locator)));
  }

  async delete(locator: string) {
    await rm(this.filePath(locator), { force: true });
  }
}
