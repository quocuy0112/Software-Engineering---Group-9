import { JobApplicationService } from "@/backend/services/jobs/job-application-service";
import { applicationSubmissionSchema } from "@/shared/contracts/jobs/actions";
import {
  jobErrorResponse,
  jobJson,
  parseBoundedJson,
  requireJobActor,
} from "@/backend/security/job-request-boundary";
import { JobServiceError } from "@/backend/services/jobs/job-types";
import type { DirectApplicationCvSource } from "@/backend/services/jobs/prepare-direct-application-cv";

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

function directCvSource(file: FormDataEntryValue | null) {
  if (!(file instanceof File)) {
    throw new JobServiceError(400, {
      code: "APPLICATION_CV_INELIGIBLE",
      message: "Attach a PDF, DOC, or DOCX file before applying.",
    });
  }
  const extension = file.name.toLowerCase().split(".").pop();
  const mimeType = DIRECT_CV_MIME_TYPES.has(file.type)
    ? file.type
    : extension === "pdf"
      ? "application/pdf"
      : extension === "doc"
        ? "application/msword"
        : extension === "docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : null;
  if (!mimeType || file.size < 1 || file.size > 5_000_000) {
    throw new JobServiceError(400, {
      code: "APPLICATION_CV_INELIGIBLE",
      message: "Attach a PDF, DOC, or DOCX file between 1 and 5 MB.",
    });
  }
  return {
    fileName: file.name,
    mimeType,
    byteSize: file.size,
    source: fileStream(file),
  } satisfies DirectApplicationCvSource;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const actor = await requireJobActor(request);
    const contentType =
      request.headers.get("content-type")?.toLowerCase() ?? "";
    let command: unknown;
    let directCv: DirectApplicationCvSource | undefined;
    let directCoverLetter: DirectApplicationCvSource | undefined;
    if (contentType.startsWith("multipart/form-data")) {
      const formData = await request.formData();
      const application = formData.get("application");
      if (typeof application !== "string") {
        throw new JobServiceError(400, {
          code: "APPLICATION_CV_INELIGIBLE",
          message: "The application payload is missing.",
        });
      }
      try {
        command = JSON.parse(application);
      } catch {
        throw new JobServiceError(400, {
          code: "APPLICATION_CV_INELIGIBLE",
          message: "The application payload is invalid.",
        });
      }
      directCv = directCvSource(formData.get("cvFile"));
      if (formData.get("coverLetterFile") instanceof File) {
        directCoverLetter = directCvSource(formData.get("coverLetterFile"));
      }
    } else {
      command = await parseBoundedJson(
        request,
        applicationSubmissionSchema,
        64 * 1024,
      );
    }
    const result = await new JobApplicationService().submit(
      actor,
      (await context.params).jobId,
      request.headers.get("idempotency-key") ?? "",
      command,
      new Date(),
      directCv,
      directCoverLetter,
    );
    return jobJson(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    return jobErrorResponse(error);
  }
}
