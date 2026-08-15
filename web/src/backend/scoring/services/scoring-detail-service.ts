import "server-only";

import { prisma } from "@/backend/database/prisma";
import { RecruiterApplicationAuthorization } from "@/backend/applications/authorization/recruiter-application-authorization";
import { PrismaScoringRepository } from "../repositories/prisma-scoring-repository";
import { scoringDetailSchema, type ScoringState } from "@/shared/contracts/scoring";

export class ScoringDetailService {
  constructor(
    private readonly db: typeof prisma = prisma,
    private readonly authorization = new RecruiterApplicationAuthorization(),
    private readonly scoring = new PrismaScoringRepository(db),
  ) {}

  async get(userId: string, applicationId: string) {
    const application = await this.db.jobApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        jobPostingId: true,
        scoringStatus: true,
        scoringOperations: {
          where: { state: { in: ["QUEUED", "RUNNING"] }, kind: { in: ["AI_RETRY", "JOB_RESCORE"] } },
          orderBy: { requestedAt: "desc" },
          take: 2,
          select: { id: true, kind: true },
        },
      },
    });
    if (!application || !(await this.authorization.authorizeApplication(userId, application.jobPostingId, application.id)).authorized) throw new Error("APPLICATION_UNAVAILABLE");

    const current = await this.scoring.findCurrent(application.id);
    const retry = application.scoringOperations.find((operation) => operation.kind === "AI_RETRY");
    const activeRescore = application.scoringOperations.some((operation) => operation.kind === "JOB_RESCORE");
    let scoring: ScoringState;
    if (retry && current?.automatic) {
      scoring = { kind: "PENDING", label: "Pending", operationId: retry.id, automaticMatch: current.automatic };
    } else if (current?.state === "SCORED" && current.ai && current.finalScore) {
      scoring = { kind: "SCORED", label: "Scored", automaticMatch: current.automatic, aiAssessment: current.ai, finalScore: current.finalScore };
    } else if (current?.automatic) {
      scoring = {
        kind: "UNAVAILABLE",
        label: "Unavailable",
        automaticMatch: current.automatic,
        aiAssessment: { kind: "UNAVAILABLE", label: "Unavailable", safeFailureCode: "AI_PROVIDER_UNAVAILABLE", supportGuidance: current.consecutiveFailures >= 3 ? "Repeated AI failure - try later or contact support." : null },
        finalScore: { kind: "NOT_CALCULATED", label: "Not calculated" },
        retryAllowed: true,
        consecutiveFailures: Math.max(1, current.consecutiveFailures),
      };
    } else if (application.scoringStatus === "PENDING") {
      scoring = { kind: "PENDING", label: "Pending", operationId: "pending-" + application.id, automaticMatch: null };
    } else if (application.scoringStatus === "PROCESSING") {
      scoring = { kind: "PROCESSING", label: "Processing", operationId: "initial-" + application.id };
    } else {
      scoring = { kind: "NOT_CALCULATED", label: "Not calculated" };
    }
    return scoringDetailSchema.parse({
      applicationId: application.id,
      humanDecisionNotice: "Scores support decision-making only. The recruiter makes the final decision.",
      scoring,
      rescoreInProgress: activeRescore || Boolean(current?.rescoreInProgress),
      documentAccess: {
        cvViewerPath: "/api/recruiter/jobs/" + encodeURIComponent(application.jobPostingId) + "/applications/" + encodeURIComponent(application.id) + "/documents/cv",
        coverLetterViewerPath: "/api/recruiter/jobs/" + encodeURIComponent(application.jobPostingId) + "/applications/" + encodeURIComponent(application.id) + "/documents/cover-letter",
      },
    });
  }
}
