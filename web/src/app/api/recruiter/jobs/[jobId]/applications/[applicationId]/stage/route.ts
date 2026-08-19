import { ApplicationStageService } from "@/backend/services/jobs/application-stage-service";
import { JobServiceError } from "@/backend/services/jobs/job-types";
import {
  AccountRequestError,
  accountErrorResponse,
  accountJson,
  parseBoundedJson,
  requireAccountRequest,
} from "@/backend/security/account-request-boundary";
import {
  idempotencyKeySchema,
  stageTransitionCommandSchema,
  stageTransitionOutcomeSchema,
} from "@/shared/contracts/applications";

export async function PATCH(request: Request, context: { params: Promise<{ jobId: string; applicationId: string }> }) {
  let actor: Awaited<ReturnType<typeof requireAccountRequest>> | null = null;
  let params: { jobId: string; applicationId: string } | null = null;
  try {
    actor = await requireAccountRequest(request, { mutation: true });
    params = await context.params;
    const idempotency = idempotencyKeySchema.safeParse(request.headers.get("idempotency-key"));
    if (!idempotency.success) {
      return accountJson({ code: "IDEMPOTENCY_KEY_REQUIRED", message: "A valid Idempotency-Key is required." }, { status: 400 });
    }
    const command = await parseBoundedJson(request, stageTransitionCommandSchema, 8 * 1024);
    const stageService = new ApplicationStageService();
    const result = await stageService.attemptStageTransition({
      candidateApplicationId: params.applicationId,
      targetStage: command.targetStage,
      actor: {
        kind: "recruiter_manual",
        userId: actor.userId,
        sessionId: actor.sessionId,
      },
      requestedJobId: params.jobId,
      expectedStageVersion: command.expectedStageVersion,
      // Button actions retain the legacy default. Drag-and-drop sends an
      // explicit drag intent so the stricter drag policy is enforced.
      intent: command.intent ?? "button",
      idempotencyKey: idempotency.data,
      confirmed: command.confirmed,
      reasonCode: command.reasonCode,
      candidateVisibleReason: command.candidateVisibleReason,
      internalNote: command.internalNote,
      source: "KANBAN",
    });
    return accountJson(stageTransitionOutcomeSchema.parse(result));
  } catch (error) {
    if (error instanceof AccountRequestError) return accountErrorResponse(error);
    if (error instanceof JobServiceError) {
      const conflictCodes = ["APPLICATION_STAGE_CONFLICT", "APPLICATION_STAGE_TRANSITION_INVALID", "IDEMPOTENCY_CONFLICT"];
      if (error.status === 409 && conflictCodes.includes(error.body.code) && actor && params) {
        const current = await new ApplicationStageService().currentAuthorizedState(actor.userId, params.jobId, params.applicationId);
        if (current) return accountJson({ ...error.body, current }, { status: 409 });
      }
      return accountJson(error.body, { status: error.status });
    }
    return accountJson({ code: "JOB_SERVICE_UNAVAILABLE", message: "The stage change could not be completed." }, { status: 503 });
  }
}
