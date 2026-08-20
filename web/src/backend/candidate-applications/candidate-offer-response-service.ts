import "server-only";

import { ApplicationStageService } from "@/backend/services/jobs/application-stage-service";
import { JobServiceError } from "@/backend/services/jobs/job-types";
import {
  offerResponseCommandSchema,
  offerResponseOutcomeSchema,
  type OfferResponseCommand,
  type OfferResponseOutcome,
} from "@/shared/contracts/candidate-applications";
import type { CandidateActor } from "@/backend/services/jobs/job-types";
import { CandidateApplicationError } from "./candidate-application-errors";

function targetStage(command: OfferResponseCommand) {
  return command.decision === "ACCEPT" ? "HIRED" : "OFFER_DECLINED";
}

function responseReason(command: OfferResponseCommand) {
  return command.decision === "ACCEPT"
    ? "CANDIDATE_ACCEPTED_OFFER"
    : "CANDIDATE_DECLINED_OFFER";
}

function responseReasonLabel(command: OfferResponseCommand) {
  return command.decision === "ACCEPT"
    ? "Candidate accepted the offer"
    : "Candidate declined the offer";
}

function outcome(row: {
  applicationId: string;
  stageEventId: string;
  fromStage: string;
  stage: string;
  stageVersion: number;
  lastStageChangedAt: string;
}) {
  if (
    row.fromStage !== "OFFERED" ||
    !["HIRED", "OFFER_DECLINED", "WAITLISTED"].includes(row.stage)
  ) {
    throw new CandidateApplicationError(
      409,
      "APPLICATION_OFFER_RESPONSE_UNAVAILABLE",
      "This offer response is no longer available.",
    );
  }
  return offerResponseOutcomeSchema.parse({
    applicationId: row.applicationId,
    fromStage: "OFFERED",
    stage: row.stage,
    stageVersion: row.stageVersion,
    lastStageChangedAt: row.lastStageChangedAt,
    eventId: row.stageEventId,
  });
}

function mapStageError(error: JobServiceError): CandidateApplicationError {
  switch (error.body.code) {
    case "APPLICATION_STAGE_CONFLICT":
      return new CandidateApplicationError(
        409,
        "APPLICATION_STAGE_CONFLICT",
        "This application changed. Refresh it and try again.",
      );
    case "APPLICATION_WITHDRAWAL_BLOCKED":
      return new CandidateApplicationError(
        409,
        "APPLICATION_OFFER_RESPONSE_BLOCKED",
        "This application has been withdrawn.",
      );
    case "APPLICATION_UNAVAILABLE":
      return new CandidateApplicationError(
        404,
        "APPLICATION_UNAVAILABLE",
        "This application is unavailable.",
      );
    default:
      return new CandidateApplicationError(
        error.status === 409 ? 409 : 400,
        error.body.code,
        error.body.message,
      );
  }
}

export class CandidateOfferResponseService {
  constructor(
    private readonly stageService = new ApplicationStageService(),
  ) {}

  async respond(
    actor: CandidateActor,
    applicationId: string,
    idempotencyKey: string,
    rawCommand: unknown,
    now = new Date(),
  ): Promise<OfferResponseOutcome> {
    const command = offerResponseCommandSchema.parse(rawCommand);
    if (
      !idempotencyKey ||
      idempotencyKey.length < 16 ||
      idempotencyKey.length > 128
    ) {
      throw new CandidateApplicationError(
        400,
        "APPLICATION_IDEMPOTENCY_KEY_INVALID",
        "Refresh the application and try again.",
      );
    }

    try {
      const result = await this.stageService.attemptStageTransition({
        candidateApplicationId: applicationId,
        targetStage: targetStage(command),
        actor: {
          kind: "candidate_response",
          userId: actor.userId,
          sessionId: actor.sessionId,
        },
        expectedStageVersion: command.expectedVersion,
        idempotencyKey,
        reasonCode: responseReason(command),
        candidateVisibleReason: responseReasonLabel(command),
        now,
      });

      return outcome({
        applicationId: result.applicationId,
        stageEventId: result.stageEventId,
        fromStage: result.fromStage,
        stage: result.stage,
        stageVersion: result.stageVersion,
        lastStageChangedAt: result.lastStageChangedAt,
      });
    } catch (error) {
      if (error instanceof CandidateApplicationError) throw error;
      if (error instanceof JobServiceError) throw mapStageError(error);
      throw error;
    }
  }
}
