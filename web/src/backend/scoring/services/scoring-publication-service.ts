import {
  assertCompatibleLineage,
  calculateHybridScore,
} from "../domain/hybrid-score-calculator";
import type { ScoringRepositoryPort } from "../repositories/scoring-repository";
import type { AiAssessment, AutomaticMatch } from "@/shared/contracts/scoring";

export class ScoringPublicationService {
  constructor(private readonly repository: ScoringRepositoryPort) {}

  async publishDeterministic(input: {
    applicationId: string;
    operationId: string;
    workItemId?: string;
    expectedGeneration?: number;
    workerId?: string;
    automatic: AutomaticMatch;
    consecutiveFailures?: number;
    failureCode?: string;
  }) {
    return this.repository.publish({
      applicationId: input.applicationId,
      operationId: input.operationId,
      workItemId: input.workItemId,
      expectedGeneration: input.expectedGeneration,
      workerId: input.workerId,
      automatic: input.automatic,
      ai: null,
      finalScore: null,
      consecutiveFailures: input.consecutiveFailures,
      safeFailureCode: input.failureCode,
    });
  }

  async publishHybrid(input: {
    applicationId: string;
    operationId: string;
    workItemId?: string;
    expectedGeneration?: number;
    workerId?: string;
    automatic: AutomaticMatch;
    ai: AiAssessment;
    aiLineage?: { cvVersion: string; jdVersion: string; configVersion: string };
  }) {
    assertCompatibleLineage(
      input.automatic,
      input.aiLineage ?? {
        cvVersion: input.automatic.cvVersion,
        jdVersion: input.automatic.jdVersion,
        configVersion: input.automatic.configVersion,
      },
    );
    const finalScore = calculateHybridScore({
      automatic: input.automatic,
      ai: input.ai,
    });
    return this.repository.publish({
      applicationId: input.applicationId,
      operationId: input.operationId,
      workItemId: input.workItemId,
      expectedGeneration: input.expectedGeneration,
      workerId: input.workerId,
      automatic: input.automatic,
      ai: input.ai,
      finalScore,
      consecutiveFailures: 0,
      safeFailureCode: undefined,
    });
  }
}
