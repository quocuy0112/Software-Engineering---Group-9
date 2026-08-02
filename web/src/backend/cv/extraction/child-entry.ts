import { extractDocx } from "./docx";
import { extractPdf } from "./pdf";
import type { ExtractionChildRequest } from "./document-extractor";

async function main(): Promise<void> {
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
    const value =
      raw.kind === "PDF"
        ? await extractPdf(source, raw.limits)
        : await extractDocx(source, raw.limits);
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
  }
}

void main();
