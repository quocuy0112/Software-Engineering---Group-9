import "server-only";

import { DocumentExtractionError } from "./document-extractor";

const MAX_EXTRACTED_BYTES = 512 * 1024;

function replaceControlCharacters(value: string): string {
  return Array.from(value, (character) => {
    const code = character.codePointAt(0) ?? 0;
    const isControlCharacter =
      code <= 0x08 ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f) ||
      code === 0x7f;
    return isControlCharacter ? " " : character;
  }).join("");
}

function cleanCandidate(value: string): string {
  return replaceControlCharacters(value).replace(/\s+/gu, " ").trim();
}

function useful(value: string): boolean {
  const cleaned = cleanCandidate(value);
  return (
    cleaned.length >= 4 &&
    /[\p{L}\p{N}]/u.test(cleaned) &&
    !/^(?:worddocument|root entry|table stream|objectpool)$/iu.test(cleaned)
  );
}

function collectUtf16Le(source: Uint8Array): string[] {
  const values: string[] = [];
  let current = "";
  const flush = () => {
    if (useful(current)) values.push(cleanCandidate(current));
    current = "";
  };
  for (let offset = 0; offset + 1 < source.byteLength; offset += 2) {
    const code = source[offset]! | (source[offset + 1]! << 8);
    const visible =
      code === 9 ||
      code === 10 ||
      code === 13 ||
      (code >= 32 && code !== 0xfffe && code !== 0xffff);
    if (visible) current += String.fromCharCode(code);
    else flush();
  }
  flush();
  return values;
}

function collectCompressedAnsi(source: Uint8Array): string[] {
  const values: string[] = [];
  let current = "";
  const flush = () => {
    if (useful(current)) values.push(cleanCandidate(current));
    current = "";
  };
  for (const value of source) {
    const visible =
      value === 9 ||
      value === 10 ||
      value === 13 ||
      (value >= 32 && value <= 126);
    if (visible) current += String.fromCharCode(value);
    else flush();
  }
  flush();
  return values;
}

/**
 * Legacy .doc files are OLE compound documents. The normal isolated parser
 * intentionally supports OOXML only, so this bounded fallback extracts the
 * readable Word text commonly stored in WordDocument streams without invoking
 * an untrusted office process. It is deliberately conservative: malformed or
 * image-only documents still fail the shared CV-content gate downstream.
 */
export function extractLegacyDocText(source: Uint8Array) {
  const candidates = [
    ...collectUtf16Le(source),
    ...collectCompressedAnsi(source),
  ];
  const text = [...new Set(candidates)]
    .join("\n")
    .slice(0, MAX_EXTRACTED_BYTES);
  if (!text) throw new DocumentExtractionError("EMPTY_TEXT");
  if (Buffer.byteLength(text, "utf8") >= MAX_EXTRACTED_BYTES)
    throw new DocumentExtractionError("OUTPUT_LIMIT");
  return Object.freeze({
    segments: Object.freeze([
      Object.freeze({
        id: "legacy-doc-body",
        kind: "paragraph" as const,
        text,
      }),
    ]),
    pageCount: null,
    entryCount: null,
    expandedBytes: source.byteLength,
  });
}
