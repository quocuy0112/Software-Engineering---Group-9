import { RecruiterApplicationDecisionService } from "@/backend/applications/services/recruiter-application-decision-service";
import { JobServiceError } from "@/backend/services/jobs/job-types";
import { AccountRequestError, accountErrorResponse, accountJson, parseBoundedJson, requireAccountRequest } from "@/backend/security/account-request-boundary";
import { idempotencyKeySchema } from "@/shared/contracts/applications";
import { decisionOutcomeSchema, interviewDecisionRequestSchema } from "@/shared/contracts/scoring";

export async function POST(request: Request, context: { params: Promise<{ applicationId: string }> }) {
  try {
    const current = await requireAccountRequest(request, { mutation: true });
    const idempotencyKey = idempotencyKeySchema.parse(request.headers.get("idempotency-key"));
    const raw = await parseBoundedJson(request, interviewDecisionRequestSchema, 8 * 1024);
    const result = await new RecruiterApplicationDecisionService().moveToInterview({ ...current, applicationId: (await context.params).applicationId, idempotencyKey, raw });
    return accountJson(decisionOutcomeSchema.parse(result));
  } catch (error) {
    if (error instanceof AccountRequestError) return accountErrorResponse(error);
    if (error instanceof JobServiceError) return accountJson(error.body, { status: error.status });
    return accountJson({ code: "VALIDATION_ERROR", message: "Confirm the interview transition." }, { status: 400 });
  }
}
