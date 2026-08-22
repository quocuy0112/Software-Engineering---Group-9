export const CV_MAX_FILE_BYTES = 5_000_000;

export const CV_FILE_MIME_TYPES = Object.freeze({
  PDF: "application/pdf",
  DOC: "application/msword",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const);

export type CvFileKind = keyof typeof CV_FILE_MIME_TYPES;

export type CvFileValidationCode =
  | "FILE_REQUIRED"
  | "FILE_EMPTY"
  | "FILE_SIZE_EXCEEDED"
  | "UNSUPPORTED_FILE_TYPE"
  | "INVALID_FILE_SIGNATURE";

export class CvFileValidationError extends Error {
  readonly name = "CvFileValidationError";

  constructor(
    readonly code: CvFileValidationCode,
    message = cvFileValidationMessage(code),
  ) {
    super(message);
  }
}

export type ValidatedCvFile = Readonly<{
  kind: CvFileKind;
  mimeType: (typeof CV_FILE_MIME_TYPES)[CvFileKind];
  byteSize: number;
}>;

const SIGNATURES = {
  PDF: Uint8Array.of(0x25, 0x50, 0x44, 0x46, 0x2d),
  OLE: Uint8Array.of(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1),
  ZIP: Uint8Array.of(0x50, 0x4b, 0x03, 0x04),
} as const;

const EXTENSION_TO_KIND: Readonly<Record<string, CvFileKind>> = Object.freeze({
  pdf: "PDF",
  doc: "DOC",
  docx: "DOCX",
});

function startsWithBytes(source: Uint8Array, signature: Uint8Array): boolean {
  if (source.byteLength < signature.byteLength) return false;
  return signature.every((value, index) => source[index] === value);
}

function containsAscii(source: Uint8Array, value: string): boolean {
  const needle = Uint8Array.from(
    Array.from(value, (character) => character.charCodeAt(0)),
  );
  if (needle.byteLength === 0 || source.byteLength < needle.byteLength)
    return false;
  outer: for (
    let offset = 0;
    offset <= source.byteLength - needle.byteLength;
    offset += 1
  ) {
    for (let index = 0; index < needle.byteLength; index += 1) {
      if (source[offset + index] !== needle[index]) continue outer;
    }
    return true;
  }
  return false;
}

function containsUtf16LeAscii(source: Uint8Array, value: string): boolean {
  if (source.byteLength < value.length * 2) return false;
  outer: for (
    let offset = 0;
    offset <= source.byteLength - value.length * 2;
    offset += 1
  ) {
    for (let index = 0; index < value.length; index += 1) {
      if (
        source[offset + index * 2] !== value.charCodeAt(index) ||
        source[offset + index * 2 + 1] !== 0
      )
        continue outer;
    }
    return true;
  }
  return false;
}

function extensionOf(fileName: string | undefined): string | null {
  if (!fileName) return null;
  const normalized = fileName.trim().toLocaleLowerCase("en-US");
  const separator = normalized.lastIndexOf(".");
  return separator < 0 ? null : normalized.slice(separator + 1);
}

function mimeKind(value: string | undefined): CvFileKind | null {
  if (!value) return null;
  const entry = Object.entries(CV_FILE_MIME_TYPES).find(
    ([, mimeType]) => mimeType === value,
  );
  return (entry?.[0] as CvFileKind | undefined) ?? null;
}

/**
 * Detect a document from its bytes. Filename and browser-declared MIME type
 * are deliberately not used for detection. DOCX additionally requires the
 * two OOXML entries so a renamed ZIP/archive is not accepted as a document.
 */
export function detectCvFileKind(source: Uint8Array): CvFileKind | null {
  if (startsWithBytes(source, SIGNATURES.PDF)) return "PDF";

  if (
    startsWithBytes(source, SIGNATURES.OLE) &&
    (containsAscii(source, "WordDocument") ||
      containsUtf16LeAscii(source, "WordDocument"))
  ) {
    return "DOC";
  }

  if (
    startsWithBytes(source, SIGNATURES.ZIP) &&
    containsAscii(source, "[Content_Types].xml") &&
    containsAscii(source, "word/document.xml")
  ) {
    return "DOCX";
  }

  return null;
}

export function cvFileValidationMessage(code: CvFileValidationCode): string {
  switch (code) {
    case "FILE_SIZE_EXCEEDED":
      return "File size must not exceed 5MB.";
    case "FILE_EMPTY":
      return "The uploaded file is empty.";
    case "INVALID_FILE_SIGNATURE":
      return "The file contents do not match a supported PDF, DOC, or DOCX document.";
    case "FILE_REQUIRED":
      return "Attach a CV file.";
    case "UNSUPPORTED_FILE_TYPE":
    default:
      return "Only PDF, DOC, or DOCX files are supported.";
  }
}

export function validateCvFileBytes(input: {
  bytes: Uint8Array;
  fileName?: string;
  declaredMimeType?: string;
}): ValidatedCvFile {
  const { bytes } = input;
  if (bytes.byteLength === 0) throw new CvFileValidationError("FILE_EMPTY");
  if (bytes.byteLength > CV_MAX_FILE_BYTES)
    throw new CvFileValidationError("FILE_SIZE_EXCEEDED");

  const detectedKind = detectCvFileKind(bytes);
  const extension = extensionOf(input.fileName);
  const extensionKind = extension ? EXTENSION_TO_KIND[extension] : null;
  if (!detectedKind || (extension && !extensionKind))
    throw new CvFileValidationError("UNSUPPORTED_FILE_TYPE");
  if (extensionKind && extensionKind !== detectedKind)
    throw new CvFileValidationError("INVALID_FILE_SIGNATURE");

  const declaredKind = mimeKind(input.declaredMimeType);
  // Empty and generic browser declarations are common and are safe because
  // the signature is authoritative. A known conflicting declaration is not.
  if (
    declaredKind &&
    declaredKind !== detectedKind &&
    input.declaredMimeType !== "application/octet-stream"
  ) {
    throw new CvFileValidationError("INVALID_FILE_SIGNATURE");
  }

  return Object.freeze({
    kind: detectedKind,
    mimeType: CV_FILE_MIME_TYPES[detectedKind],
    byteSize: bytes.byteLength,
  });
}

export async function validateCvFile(file: File): Promise<ValidatedCvFile> {
  if (!(file instanceof File)) throw new CvFileValidationError("FILE_REQUIRED");
  if (file.size > CV_MAX_FILE_BYTES)
    throw new CvFileValidationError("FILE_SIZE_EXCEEDED");
  const bytes = new Uint8Array(await file.arrayBuffer());
  return validateCvFileBytes({
    bytes,
    fileName: file.name,
    declaredMimeType: file.type,
  });
}

export function cvFileKindForMimeType(value: string): CvFileKind | null {
  return mimeKind(value);
}
