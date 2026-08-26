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
import {
  isCvFileValidationError,
  validatedCvUploadSource,
} from "@/backend/cv/validated-file-upload";
import { logCvUploadRejection } from "@/backend/cv/upload-observability";
import {
  cvUploadContentValidationMessage,
  CvUploadContentValidationError,
  validateCvUploadContent,
} from "@/backend/cv/preflight-cv-upload";

async function directCvSource(
  file: FormDataEntryValue | null,
  validateContent = false,
) {
  if (!(file instanceof File)) {
    logCvUploadRejection({ reason: "FILE_REQUIRED" });
    throw new JobServiceError(400, {
      code: "APPLICATION_CV_INELIGIBLE",
      message: "Attach a CV file before applying.",
    });
  }
  try {
    const validated = await validatedCvUploadSource(file);
    if (validateContent) {
      try {
        await validateCvUploadContent({
          bytes: validated.bytes,
          kind: validated.kind,
        });
      } catch (error) {
        if (error instanceof CvUploadContentValidationError) {
          logCvUploadRejection({
            reason: error.code,
            byteSize: file.size,
            declaredMimeType: file.type,
          });
          throw new JobServiceError(400, {
            code: "APPLICATION_CV_INELIGIBLE",
            message: cvUploadContentValidationMessage(error.code),
          });
        }
        throw error;
      }
    }
    return {
      fileName: validated.fileName,
      mimeType: validated.mimeType,
      byteSize: validated.byteSize,
      source: validated.source,
    } satisfies DirectApplicationCvSource;
  } catch (error) {
    if (isCvFileValidationError(error)) {
      logCvUploadRejection({
        reason: error.code,
        byteSize: file.size,
        declaredMimeType: file.type,
      });
      throw new JobServiceError(400, {
        code: "APPLICATION_CV_INELIGIBLE",
        message: error.message,
      });
    }
    throw error;
  }
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
      directCv = await directCvSource(formData.get("cvFile"), true);
      if (formData.get("coverLetterFile") instanceof File) {
        directCoverLetter = await directCvSource(
          formData.get("coverLetterFile"),
        );
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
