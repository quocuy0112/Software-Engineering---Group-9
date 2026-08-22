import "server-only";

import {
  CV_MAX_FILE_BYTES,
  CvFileValidationError,
  validateCvFileBytes,
  type ValidatedCvFile,
} from "@/shared/cv-file-validation";

export type ValidatedCvUploadSource = ValidatedCvFile &
  Readonly<{
    bytes: Uint8Array;
    fileName: string;
    source: AsyncIterable<Uint8Array>;
  }>;

/**
 * Read once, validate the bytes, and expose a replayable bounded stream to the
 * storage layer. This keeps signature checks before persistence and prevents a
 * caller from changing the bytes after validation.
 */
export async function validatedCvUploadSource(
  file: File,
): Promise<ValidatedCvUploadSource> {
  if (!(file instanceof File)) throw new CvFileValidationError("FILE_REQUIRED");
  if (file.size > CV_MAX_FILE_BYTES)
    throw new CvFileValidationError("FILE_SIZE_EXCEEDED");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const validated = validateCvFileBytes({
    bytes,
    fileName: file.name,
    declaredMimeType: file.type,
  });
  return Object.freeze({
    ...validated,
    bytes,
    fileName: file.name,
    source: (async function* () {
      yield bytes;
    })(),
  });
}

export function isCvFileValidationError(
  error: unknown,
): error is CvFileValidationError {
  return error instanceof CvFileValidationError;
}
