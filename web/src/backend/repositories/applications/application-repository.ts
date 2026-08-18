import "server-only";

import type {
  ApplicationPage,
  ApplicationStage,
  PipelineApplicationCard,
} from "@/shared/contracts/applications";

export type PipelineStageCounts = Record<ApplicationStage, number>;
export type PipelineStageRepositoryPage = Readonly<{
  items: ReadonlyArray<Omit<PipelineApplicationCard, "allowedDestinations">>;
  nextCursor: string | null;
}>;

export type ApplicationDocumentRecord = Readonly<{
  applicationId: string;
  jobId: string;
  stage?: ApplicationStage;
  stageVersion?: number;
  kind: "cv" | "cover-letter";
  fileName: string | null;
  mediaType: string | null;
  byteLength: number;
  storageKey: string | null;
  text: string | null;
  previewSupported: boolean;
  contentVersion?: string | null;
  applicationProfileSnapshot?: unknown;
  sourceCandidateCvId?: string | null;
}>;

export type RecruitmentPipelineRepositoryPort = Readonly<{
  countPipelineStages(jobId: string): Promise<PipelineStageCounts>;
  listPipelineStage(input: {
    jobId: string;
    stage: ApplicationStage;
    limit: number;
    cursor?: string;
  }): Promise<PipelineStageRepositoryPage>;
}>;

export type ApplicationRepositoryPort = Readonly<{
  listSubmittedCandidates(input: {
    jobId: string;
    limit: number;
    cursor?: string;
    now?: Date;
  }): Promise<ApplicationPage>;
  findDocument(input: {
    jobId: string;
    applicationId: string;
    kind: "cv" | "cover-letter";
    now?: Date;
  }): Promise<ApplicationDocumentRecord | null>;
}>;
