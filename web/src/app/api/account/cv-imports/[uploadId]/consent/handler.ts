import {
  assertCvEmptyRequestBody,
  CvAccountRequestBoundary,
  cvJsonResponse,
} from "@/backend/security/cv-account-request-boundary";
import { noStoreHeaders } from "@/backend/security/response-headers";
import { CvConsentService } from "@/backend/services/cv-import/cv-consent-service";
import {
  cvHttpErrorResponse,
  CvImportServiceError,
} from "@/backend/services/cv-import/cv-http-errors";
import { cvUploadIdSchema } from "@/shared/contracts/cv-import/common";
import {
  cvConsentGrantRequestSchema,
  cvConsentOutcomeSchema,
} from "@/shared/contracts/cv-import/consent-retention";

type ConsentBoundary = Readonly<{
  authorize: CvAccountRequestBoundary["authorize"];
  readJson(
    request: Request,
    schema: typeof cvConsentGrantRequestSchema,
    maximumBytes: number,
  ): Promise<unknown>;
}>;
type ConsentService = Readonly<{
  grant(input: Parameters<CvConsentService["grant"]>[0]): Promise<unknown>;
  revoke(input: Parameters<CvConsentService["revoke"]>[0]): Promise<void>;
}>;

export function createCvConsentHandlers(dependencies?: {
  boundary?: ConsentBoundary;
  service?: ConsentService;
}) {
  const boundary = dependencies?.boundary ?? new CvAccountRequestBoundary();
  const service = dependencies?.service ?? new CvConsentService();

  async function authorize(
    request: Request,
    context: { params: Promise<{ uploadId: string }> },
  ) {
    const id = cvUploadIdSchema.safeParse((await context.params).uploadId);
    if (!id.success) throw new CvImportServiceError("CV_IMPORT_NOT_FOUND");
    const current = await boundary.authorize(request, {
      mutation: true,
      resource: { type: "upload", id: id.data },
    });
    return { id: id.data, current };
  }

  return Object.freeze({
    async POST(
      request: Request,
      context: { params: Promise<{ uploadId: string }> },
    ): Promise<Response> {
      try {
        const { id, current } = await authorize(request, context);
        const body = await boundary.readJson(
          request,
          cvConsentGrantRequestSchema,
          4096,
        );
        const outcome = await service.grant({
          accountId: current.accountId,
          uploadId: id,
          request: cvConsentGrantRequestSchema.parse(body),
        });
        return cvJsonResponse(cvConsentOutcomeSchema.parse(outcome), {
          status: 201,
          headers: { "Retry-After": "1" },
        });
      } catch (error) {
        return cvHttpErrorResponse(
          error,
          request.headers.get("x-request-id") ?? undefined,
        );
      }
    },

    async DELETE(
      request: Request,
      context: { params: Promise<{ uploadId: string }> },
    ): Promise<Response> {
      try {
        await assertCvEmptyRequestBody(request);
        const { id, current } = await authorize(request, context);
        await service.revoke({ accountId: current.accountId, uploadId: id });
        return new Response(null, {
          status: 204,
          headers: {
            ...noStoreHeaders,
            "X-Robots-Tag": "noindex, nofollow, noarchive",
          },
        });
      } catch (error) {
        return cvHttpErrorResponse(
          error,
          request.headers.get("x-request-id") ?? undefined,
        );
      }
    },
  });
}
