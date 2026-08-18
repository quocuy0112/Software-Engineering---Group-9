import { CandidateApplicationError, candidateApplicationError } from "@/backend/candidate-applications/candidate-application-errors";
import { CandidateOfferResponseService } from "@/backend/candidate-applications/candidate-offer-response-service";
import {
  jobErrorResponse,
  jobJson,
  parseBoundedJson,
  requireJobActor,
} from "@/backend/security/job-request-boundary";
import { offerResponseCommandSchema } from "@/shared/contracts/candidate-applications";

export async function POST(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  try {
    const actor = await requireJobActor(request, { mutation: true });
    const idempotencyKey = request.headers.get("idempotency-key") ?? "";
    if (idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      throw new CandidateApplicationError(
        400,
        "APPLICATION_IDEMPOTENCY_KEY_INVALID",
        "Refresh the application and try again.",
      );
    }
    const command = await parseBoundedJson(
      request,
      offerResponseCommandSchema,
      8 * 1024,
    );
    const result = await new CandidateOfferResponseService().respond(
      actor,
      (await context.params).applicationId,
      idempotencyKey,
      command,
    );
    return jobJson(result);
  } catch (error) {
    return jobErrorResponse(candidateApplicationError(error));
  }
}
