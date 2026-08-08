import type { JobCard } from "./discovery";

export type JobPositionOption = {
  id: string;
  label: string;
  family: string;
};

export type SuggestedWorkspaceJob = JobCard & {
  matchedCriteria: string[];
};
