import { extractDocx } from "./docx";
import { createDocxOcrManifest } from "./docx-ocr-manifest";
import { extractPdf } from "./pdf";
import { createPdfOcrManifest } from "./pdf-ocr-manifest";
import { PrivateRasterWorkspace } from "./private-raster-workspace";
import type { ExtractionChildRequest } from "./document-extractor";

async function main(): Promise<void> {
  let workspace: PrivateRasterWorkspace | undefined;
  let keepWorkspace = false;
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
    const raw = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
      kind: ExtractionChildRequest["kind"];
      source: string;
      limits: ExtractionChildRequest["limits"];
    };
    const source = Buffer.from(raw.source, "base64");
    if (source.byteLength > 5_000_000)
      throw Object.assign(new Error(), { code: "OUTPUT_LIMIT" });
    workspace = await PrivateRasterWorkspace.create();
    let value;
    if (raw.kind === "PDF") {
      const manifest = await createPdfOcrManifest({ source, workspace });
      const hybrid = manifest.eligibleImageCount > 0;
      if (hybrid) {
        keepWorkspace = true;
        value = {
          segments: manifest.units.flatMap((unit) => unit.nativeSegments),
          pageCount: manifest.pageCount,
          entryCount: null,
          expandedBytes: manifest.expandedBytes,
          manifest,
          privateRasterWorkspacePath: workspace.path,
        };
      } else {
        value = await extractPdf(source, raw.limits);
      }
    } else {
      const built = await createDocxOcrManifest({
        source,
        workspace,
        limits: raw.limits,
      });
      const hybrid = built.manifest.eligibleImageCount > 0;
      if (hybrid) {
        keepWorkspace = true;
        value = {
          segments: built.nativeSegments,
          pageCount: null,
          entryCount: built.manifest.entryCount,
          expandedBytes: built.manifest.expandedBytes,
          manifest: built.manifest,
          privateRasterWorkspacePath: workspace.path,
        };
      } else {
        value = await extractDocx(source, raw.limits);
      }
    }
    process.stdout.write(JSON.stringify({ ok: true, value }));
  } catch (error) {
    const code =
      error instanceof Error &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : "EXTRACTION_FAILED";
    process.stdout.write(JSON.stringify({ ok: false, code }));
    process.exitCode = 1;
  } finally {
    if (!keepWorkspace) await workspace?.dispose();
  }
}

void main();
