import { ApplicationStageService } from "@/backend/services/jobs/application-stage-service";
import { JobServiceError } from "@/backend/services/jobs/job-types";
import { AccountRequestError, accountErrorResponse, accountJson, parseBoundedJson, requireAccountRequest } from "@/backend/security/account-request-boundary";
import { applicationStageTransitionOutcomeSchema, applicationStageTransitionSchema, idempotencyKeySchema } from "@/shared/contracts/applications";

export async function PATCH(request: Request, context: { params: Promise<{ applicationId: string }> }) {
  try {
    const actor = await requireAccountRequest(request, { mutation: true });
    const applicationId = (await context.params).applicationId;
    const idempotencyKey = idempotencyKeySchema.parse(request.headers.get("idempotency-key"));
    const command = await parseBoundedJson(request, applicationStageTransitionSchema, 8 * 1024);
    const result = await new ApplicationStageService().attemptStageTransition({
      candidateApplicationId: applicationId,
      targetStage: command.targetStage,
      actor: {
        kind: "recruiter_manual",
        userId: actor.userId,
        sessionId: actor.sessionId,
      },
      expectedStageVersion: command.expectedVersion,
      reasonCode: command.reasonCode ?? undefined,
      idempotencyKey,
      source: "STAGE_ROUTE",
    });
    return accountJson(applicationStageTransitionOutcomeSchema.parse({ applicationId: result.applicationId, fromStage: result.fromStage, stage: result.stage, stageVersion: result.stageVersion, lastStageChangedAt: result.lastStageChangedAt, eventId: result.stageEventId }));
  } catch (error) {
    if (error instanceof AccountRequestError) return accountErrorResponse(error);
    if (error instanceof JobServiceError) return accountJson(error.body, { status: error.status });
    return accountJson({ code: "VALIDATION_ERROR", message: "The stage command is invalid." }, { status: 400 });
  }
}
