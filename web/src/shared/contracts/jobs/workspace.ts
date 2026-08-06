import type { AppliedJobState } from "./catalog";
import type { JobCard } from "./discovery";

export type JobPositionOption = {
  id: string;
  label: string;
  family: string;
};

export type WorkspaceApplication = {
  application: AppliedJobState;
  job: JobCard | null;
};

export type SuggestedWorkspaceJob = JobCard & {
  matchedCriteria: string[];
};
