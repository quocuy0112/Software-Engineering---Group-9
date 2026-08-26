import "server-only";

import { isAbsolute, relative, resolve } from "node:path";

import {
  cvExtractionManifestSchema,
  type CvExtractionManifest,
} from "@/shared/contracts/ocr/cv-extraction";
import { PrivateRasterWorkspace } from "./private-raster-workspace";
import { runExtractionChild } from "./runner";

export const CV_EXTRACTION_LIMITS = Object.freeze({
  timeoutMs: 15_000,
  maximumOldSpaceMb: 192,
  maximumOutputBytes: 512 * 1024,
  maximumPdfPages: 20,
  maximumDocxEntries: 1_000,
  maximumDocxExpandedBytes: 25 * 1024 * 1024,
});

export type ExtractedSegment = Readonly<{
  id: string;
  kind: "heading" | "paragraph" | "list-item";
  text: string;
}>;

export type ExtractionChildRequest = Readonly<{
  kind: "PDF" | "DOC" | "DOCX";
  source: Uint8Array;
  limits: typeof CV_EXTRACTION_LIMITS;
}>;

export type ExtractionChildResult = Readonly<{
  segments: readonly ExtractedSegment[];
  pageCount: number | null;
  entryCount: number | null;
  expandedBytes: number;
  manifest?: CvExtractionManifest;
  privateRasterWorkspacePath?: string | null;
}>;

export class DocumentExtractionError extends Error {
  readonly name = "DocumentExtractionError";

  constructor(readonly code: string) {
    super(code);
  }

  toJSON() {
    return { name: this.name, code: this.code };
  }
}

async function boundedSource(source: Uint8Array | AsyncIterable<Uint8Array>) {
  if (ArrayBuffer.isView(source)) {
    const bytes = Uint8Array.from(source as Uint8Array);
    if (bytes.byteLength > 5_000_000)
      throw new DocumentExtractionError("OUTPUT_LIMIT");
    return bytes;
  }
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for await (const chunk of source) {
    bytes += chunk.byteLength;
    if (bytes > 5_000_000) throw new DocumentExtractionError("OUTPUT_LIMIT");
    chunks.push(Uint8Array.from(chunk));
  }
  const result = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export class IsolatedDocumentExtractor {
  readonly limits = CV_EXTRACTION_LIMITS;

  constructor(
    private readonly dependencies: Readonly<{
      runChild(request: ExtractionChildRequest): Promise<ExtractionChildResult>;
    }> = { runChild: runExtractionChild },
  ) {}

  async extract(input: {
    kind: "PDF" | "DOC" | "DOCX";
    scanStatus:
      | "QUEUED"
      | "PROCESSING"
      | "CLEAN"
      | "INFECTED"
      | "INDETERMINATE";
    source: Uint8Array | AsyncIterable<Uint8Array>;
  }): Promise<ExtractionChildResult> {
    if (input.scanStatus !== "CLEAN")
      throw new DocumentExtractionError("CV_EXTRACTION_REQUIRES_CLEAN_SCAN");
    const source = await boundedSource(input.source);
    let childResult: ExtractionChildResult | undefined;
    try {
      const result = await this.dependencies.runChild({
        kind: input.kind,
        source,
        limits: this.limits,
      });
      childResult = result;
      const manifest = result.manifest
        ? cvExtractionManifestSchema.parse(result.manifest)
        : undefined;
      if (manifest) {
        const workspace = result.privateRasterWorkspacePath;
        if (!workspace || !isAbsolute(workspace))
          throw new DocumentExtractionError("CV_RASTER_PATH_INVALID");
        for (const unit of manifest.units) {
          const path = unit.privateNormalizedPngPath;
          if (!path) continue;
          const child = relative(resolve(workspace), resolve(path));
          if (!child || child.startsWith("..") || isAbsolute(child))
            throw new DocumentExtractionError("CV_RASTER_PATH_INVALID");
        }
      }
      const ids = new Set<string>();
      let outputBytes = 0;
      const segments = result.segments.map((segment) => {
        const text = segment.text
          .normalize("NFKC")
          .replace(/\r\n?/gu, "\n")
          .trim();
        if (!text || ids.has(segment.id))
          throw new DocumentExtractionError("EMPTY_TEXT");
        ids.add(segment.id);
        outputBytes += Buffer.byteLength(text, "utf8");
        return Object.freeze({ ...segment, text });
      });
      if (!segments.length && !manifest)
        throw new DocumentExtractionError("EMPTY_TEXT");
      if (outputBytes > this.limits.maximumOutputBytes)
        throw new DocumentExtractionError("OUTPUT_LIMIT");
      return Object.freeze({
        ...result,
        segments: Object.freeze(segments),
        manifest,
      });
    } catch (error) {
      if (childResult?.privateRasterWorkspacePath)
        await PrivateRasterWorkspace.disposeOwned(
          childResult.privateRasterWorkspacePath,
        );
      if (error instanceof DocumentExtractionError) throw error;
      if (
        error instanceof Error &&
        "code" in error &&
        typeof error.code === "string"
      )
        throw new DocumentExtractionError(error.code);
      throw new DocumentExtractionError("EXTRACTION_FAILED");
    } finally {
      source.fill(0);
    }
  }
}
