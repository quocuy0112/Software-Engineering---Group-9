import "server-only";

export type ExportArtifact = Readonly<{
  locator: string;
  checksum: string;
  byteCount: number;
}>;

export interface ExportArtifactStorage {
  put(exportId: string, content: Buffer): Promise<ExportArtifact>;
  get(locator: string): Promise<Buffer>;
  delete(locator: string): Promise<void>;
}
