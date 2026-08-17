"use client";

import { useState } from "react";
import { CandidateRankingList } from "./candidate-ranking-list";
import { RecruitmentPipelineBoard } from "./recruitment-pipeline-board";

export function RecruiterCandidateWorkspace({ jobId, jobTitle, backHref }: { jobId: string; jobTitle: string; backHref: string }) {
  const [view, setView] = useState<"list" | "kanban">("list");
  return <section className="recruiter-candidate-workspace"><div className="candidate-workspace-view-switch" aria-label="Candidate workspace view"><button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>List</button><button type="button" aria-pressed={view === "kanban"} onClick={() => setView("kanban")}>Kanban</button></div>{view === "list" ? <CandidateRankingList jobId={jobId} jobTitle={jobTitle} backHref={backHref} /> : <RecruitmentPipelineBoard jobId={jobId} />}</section>;
}
