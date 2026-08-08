import {
  AccountRequestError,
  accountErrorResponse,
  accountJson,
  requireAccountRequest,
} from "@/backend/security/account-request-boundary";
import { prepareDirectApplicationCv } from "@/backend/services/jobs/prepare-direct-application-cv";
import { saveDirectCandidateCv } from "@/backend/services/profile/save-direct-candidate-cv";

const DIRECT_CV_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function fileStream(file: File): AsyncIterable<Uint8Array> {
  return (async function* () {
    const reader = file.stream().getReader();
    try {
      while (true) {
        const result = await reader.read();
        if (result.done) return;
        yield result.value;
      }
    } finally {
      reader.releaseLock();
    }
  })();
}

function sourceFrom(formData: FormData) {
  const entry = formData.get("file");
  if (!(entry instanceof File)) {
    throw new AccountRequestError(400, {
      code: "VALIDATION_ERROR",
      message: "Attach a PDF, DOC, or DOCX file.",
    });
  }
  const extension = entry.name.toLowerCase().split(".").pop();
  const mimeType = DIRECT_CV_MIME_TYPES.has(entry.type)
    ? entry.type
    : extension === "pdf"
      ? "application/pdf"
      : extension === "doc"
        ? "application/msword"
        : extension === "docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : null;
  if (!mimeType || entry.size < 1 || entry.size > 5_000_000) {
    throw new AccountRequestError(400, {
      code: "VALIDATION_ERROR",
      message: "Attach a PDF, DOC, or DOCX file between 1 and 5 MB.",
    });
  }
  return {
    fileName: entry.name,
    mimeType,
    byteSize: entry.size,
    source: fileStream(entry),
  };
}

export async function POST(request: Request) {
  try {
    const current = await requireAccountRequest(request, { mutation: true });
    if (
      !request.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("multipart/form-data")
    ) {
      throw new AccountRequestError(400, {
        code: "INVALID_REQUEST",
        message: "Attach a CV file.",
      });
    }
    const prepared = await prepareDirectApplicationCv(
      sourceFrom(await request.formData()),
    );
    const saved = await saveDirectCandidateCv(
      current.userId,
      prepared,
      new Date(),
    );
    return accountJson(saved, { status: 201 });
  } catch (error) {
    return accountErrorResponse(error);
  }
}
