import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CandidateRankingList } from "@/frontend/features/recruiter-applications/candidate-ranking-list";

const page = {
  items: [{
    applicationId: "app-1",
    stage: "APPLIED" as const,
    stageVersion: 1,
    submittedAt: "2026-08-15T00:00:00.000Z",
    candidate: { displayName: "Candidate One", verifiedEmail: "candidate@example.com", avatarUrl: null },
    experienceYears: null,
    skills: [],
    scoring: { kind: "PROCESSING" as const, label: "Processing" as const, operationId: "operation-1" },
    scoreSummary: { automatic: null, ai: null, final: null, band: null },
    manuallyPrioritized: false,
    manualPriority: null,
    allowedActions: { moveToInterview: { allowed: true as const, label: "Move to interview" }, reject: { allowed: true as const, label: "Reject" } },
  }],
  nextCursor: null,
  rankingSnapshotId: "snapshot-1",
  activeFilters: [],
  processingExcludedCount: 0,
  processingExclusionLabel: null,
  defaultRejectedExclusionLabel: "Rejected candidates are excluded from the active pipeline.",
  rescoreInProgress: false,
  lastScoredAt: "2026-07-30T02:42:00.000Z",
  filteredCandidates: 1,
  totalCandidates: 1,
  summary: { total: 1, strong: 0, review: 0, low: 0, processing: 1 },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("candidate ranking list", () => {
  it("shows governance copy and keeps processing distinct from a zero score", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(page), { status: 200, headers: { "Content-Type": "application/json" } })));
    render(<CandidateRankingList jobId="job-1" jobTitle="Senior Engineer" />);
    expect(await screen.findByText("Candidate One")).toBeInTheDocument();
    expect(screen.getByText("Scores support decision-making only.")).toBeInTheDocument();
    expect(screen.getAllByText("Processing").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Recruitment" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Campaigns" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Senior Engineer" })).toBeInTheDocument();
    expect(screen.getByText(/1 applications/)).toBeInTheDocument();
    expect(screen.getByText(/Last scored:/)).toBeInTheDocument();
    expect(screen.getAllByText("New").length).toBeGreaterThan(0);
    expect(screen.getByRole("columnheader", { name: "AI" })).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("keeps the score filter visible and exposes clear filters", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ...page, activeFilters: [{ code: "SCORE", label: "Score: 80–100", removeToken: "score" }] }), { status: 200 })));
    render(<CandidateRankingList jobId="job-1" jobTitle="Senior Engineer" />);
    await screen.findByText("Candidate One");
    fireEvent.change(screen.getByLabelText("Total score"), { target: { value: "80-100" } });
    await waitFor(() => expect(screen.getByText("Clear filters")).toBeInTheDocument());
  });
});
