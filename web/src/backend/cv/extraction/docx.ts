import "server-only";

import { posix } from "node:path";
import { promisify } from "node:util";

import { XMLParser } from "fast-xml-parser";
import mammoth from "mammoth";
import yauzl, { type Entry, type ZipFile } from "yauzl";

import {
  DocumentExtractionError,
  type ExtractionChildResult,
} from "./document-extractor";

type Limits = Readonly<{
  maximumDocxEntries: number;
  maximumDocxExpandedBytes: number;
  maximumOutputBytes: number;
}>;

const openZip = promisify<Buffer, yauzl.Options, ZipFile>(yauzl.fromBuffer);

function canonicalPath(filename: string) {
  const replaced = filename.replaceAll("\\", "/");
  const normalized = posix.normalize(replaced);
  if (
    replaced.startsWith("/") ||
    /^[A-Za-z]:/u.test(replaced) ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../")
  )
    throw new DocumentExtractionError("TRAVERSAL");
  return normalized;
}

function nextEntry(zip: ZipFile): Promise<Entry | null> {
  return new Promise((resolve, reject) => {
    const onEntry = (entry: Entry) => {
      cleanup();
      resolve(entry);
    };
    const onEnd = () => {
      cleanup();
      resolve(null);
    };
    const onError = () => {
      cleanup();
      reject(new DocumentExtractionError("MALFORMED_ZIP"));
    };
    const cleanup = () => {
      zip.off("entry", onEntry);
      zip.off("end", onEnd);
      zip.off("error", onError);
    };
    zip.once("entry", onEntry);
    zip.once("end", onEnd);
    zip.once("error", onError);
    zip.readEntry();
  });
}

function readEntry(zip: ZipFile, entry: Entry, cap: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error || !stream)
        return reject(new DocumentExtractionError("MALFORMED_ZIP"));
      const chunks: Buffer[] = [];
      let bytes = 0;
      stream.on("data", (chunk: Buffer) => {
        bytes += chunk.byteLength;
        if (bytes > cap)
          stream.destroy(new DocumentExtractionError("EXPANDED_LIMIT"));
        else chunks.push(Buffer.from(chunk));
      });
      stream.once("error", (streamError) => reject(streamError));
      stream.once("end", () => resolve(Buffer.concat(chunks)));
    });
  });
}

function inspectXml(filename: string, xml: Buffer) {
  const text = xml.toString("utf8");
  if (/<!DOCTYPE|<!ENTITY/iu.test(text))
    throw new DocumentExtractionError("ACTIVE_CONTENT");
  if (
    /<(?:\w+:)?Relationship\b[^>]*\bTargetMode\s*=\s*["']External["']/iu.test(
      text,
    )
  )
    throw new DocumentExtractionError("EXTERNAL_RELATIONSHIP");
  if (/<(?:\w+:)?(?:oleObject|object|control)\b/iu.test(text))
    throw new DocumentExtractionError("OLE");
  try {
    new XMLParser({
      ignoreAttributes: false,
      processEntities: false,
      allowBooleanAttributes: false,
    }).parse(text);
  } catch {
    throw new DocumentExtractionError("MALFORMED_ZIP");
  }
  if (/activeX/iu.test(filename)) throw new DocumentExtractionError("ACTIVEX");
}

export async function extractDocx(
  source: Uint8Array,
  limits: Limits,
): Promise<ExtractionChildResult> {
  if (source[0] !== 0x50 || source[1] !== 0x4b)
    throw new DocumentExtractionError("MALFORMED_ZIP");
  let zip: ZipFile;
  try {
    zip = await openZip(Buffer.from(source), {
      lazyEntries: true,
      decodeStrings: true,
      validateEntrySizes: true,
      strictFileNames: true,
    });
  } catch {
    throw new DocumentExtractionError("MALFORMED_ZIP");
  }
  const names = new Set<string>();
  const required = new Set([
    "[Content_Types].xml",
    "_rels/.rels",
    "word/document.xml",
  ]);
  let entryCount = 0;
  let expandedBytes = 0;
  try {
    while (true) {
      const entry = await nextEntry(zip);
      if (!entry) break;
      entryCount += 1;
      if (entryCount > limits.maximumDocxEntries)
        throw new DocumentExtractionError("ENTRY_LIMIT");
      const filename = canonicalPath(entry.fileName);
      if (names.has(filename))
        throw new DocumentExtractionError("DUPLICATE_PATH");
      names.add(filename);
      required.delete(filename);
      if (![0, 8].includes(entry.compressionMethod))
        throw new DocumentExtractionError("MALFORMED_ZIP");
      expandedBytes += entry.uncompressedSize;
      if (expandedBytes > limits.maximumDocxExpandedBytes)
        throw new DocumentExtractionError("ZIP_BOMB");
      if (/vbaProject\.bin$/iu.test(filename))
        throw new DocumentExtractionError("MACRO");
      if (/^(?:word\/)?(?:embeddings|activeX)\//iu.test(filename))
        throw new DocumentExtractionError(
          filename.includes("activeX") ? "ACTIVEX" : "OLE",
        );
      if (/\.xml(?:\.rels)?$/iu.test(filename) || filename.endsWith(".rels")) {
        const xml = await readEntry(
          zip,
          entry,
          limits.maximumDocxExpandedBytes,
        );
        inspectXml(filename, xml);
      }
    }
  } finally {
    zip.close();
  }
  if (required.size) throw new DocumentExtractionError("MALFORMED_ZIP");
  let rawText: string;
  try {
    const result = await mammoth.extractRawText({
      buffer: Buffer.from(source),
    });
    rawText = result.value;
  } catch {
    throw new DocumentExtractionError("MALFORMED_ZIP");
  }
  const paragraphs = rawText
    .normalize("NFKC")
    .split(/\r?\n+/u)
    .map((value) => value.replace(/\s+/gu, " ").trim())
    .filter(Boolean);
  if (!paragraphs.length) throw new DocumentExtractionError("EMPTY_TEXT");
  let outputBytes = 0;
  const segments = paragraphs.map((text, index) => {
    outputBytes += Buffer.byteLength(text, "utf8");
    if (outputBytes > limits.maximumOutputBytes)
      throw new DocumentExtractionError("OUTPUT_LIMIT");
    return {
      id: `docx-paragraph-${index + 1}`,
      kind: "paragraph" as const,
      text,
    };
  });
  return { segments, pageCount: null, entryCount, expandedBytes };
}
