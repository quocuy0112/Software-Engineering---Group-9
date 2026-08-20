import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CandidateRankingList } from "@/frontend/features/recruiter-applications/candidate-ranking-list";

const page = {
  items: [
    {
      applicationId: "app-1",
      stage: "APPLIED" as const,
      stageVersion: 1,
      submittedAt: "2026-08-15T00:00:00.000Z",
      candidate: {
        displayName: "Candidate One",
        verifiedEmail: "candidate@example.com",
        avatarUrl: null,
      },
      experienceYears: null,
      skills: [],
      scoring: {
        kind: "PROCESSING" as const,
        label: "Processing" as const,
        operationId: "operation-1",
      },
      scoreSummary: { automatic: null, ai: null, final: null, band: null },
      manuallyPrioritized: false,
      manualPriority: null,
      allowedActions: {
        moveToInterview: { allowed: true as const, label: "Move to interview" },
        reject: { allowed: true as const, label: "Reject" },
      },
    },
  ],
  nextCursor: null,
  rankingSnapshotId: "snapshot-1",
  activeFilters: [],
  processingExcludedCount: 0,
  processingExclusionLabel: null,
  defaultRejectedExclusionLabel:
    "Rejected candidates are excluded from the active pipeline.",
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
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(page), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    render(<CandidateRankingList jobId="job-1" jobTitle="Senior Engineer" />);
    expect(await screen.findByText("Candidate One")).toBeInTheDocument();
    expect(
      screen.getByText("Scores support decision-making only."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Processing").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", { name: "Recruitment" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Campaigns" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Senior Engineer" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 applications/)).toBeInTheDocument();
    expect(screen.getByText(/Last scored:/)).toBeInTheDocument();
    expect(screen.getAllByText("New").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("columnheader", { name: "AI" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("keeps the score filter visible and exposes clear filters", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              ...page,
              activeFilters: [
                { code: "SCORE", label: "Score: 80–100", removeToken: "score" },
              ],
            }),
            { status: 200 },
          ),
      ),
    );
    render(<CandidateRankingList jobId="job-1" jobTitle="Senior Engineer" />);
    await screen.findByText("Candidate One");
    fireEvent.change(screen.getByLabelText("Total score"), {
      target: { value: "80-100" },
    });
    await waitFor(() =>
      expect(screen.getByText("Clear filters")).toBeInTheDocument(),
    );
  });

  it("renders numbered pagination and loads a directly selected page", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const requestUrl = new URL(String(input), "https://test.local");
      const pageIndex = Number(requestUrl.searchParams.get("page") ?? 0);
      const currentPage = {
        ...page,
        items: [
          {
            ...page.items[0],
            applicationId: `app-${pageIndex + 1}`,
            candidate: {
              ...page.items[0].candidate,
              displayName: `Candidate ${pageIndex * 10 + 1}`,
            },
          },
        ],
        filteredCandidates: 260,
        totalCandidates: 260,
        nextCursor: pageIndex < 25 ? "cursor" : null,
        summary: { ...page.summary, total: 260, processing: 260 },
      };
      return new Response(JSON.stringify(currentPage), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<CandidateRankingList jobId="job-1" jobTitle="Senior Engineer" />);

    expect(await screen.findByText("Candidate 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 26" })).toBeInTheDocument();
    expect(screen.getByText("...")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Page 26" }));
    expect(await screen.findByText("Candidate 251")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining("page=25"),
      expect.anything(),
    );
    expect(
      screen.getByText("Showing 251–260 of 260 candidates"),
    ).toBeInTheDocument();
  });

  it("shows the cached ranking immediately while revalidating after remount", async () => {
    const updatedPage = {
      ...page,
      items: [
        {
          ...page.items[0],
          candidate: {
            ...page.items[0].candidate,
            displayName: "Candidate Updated",
          },
        },
      ],
    };
    let resolveRefresh: ((response: Response) => void) | undefined;
    const refreshResponse = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    const response = (payload: unknown) =>
      new Response(JSON.stringify(payload), { status: 200 });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(page))
      .mockImplementationOnce(() => refreshResponse);
    vi.stubGlobal("fetch", fetchMock);

    const firstRender = render(
      <CandidateRankingList jobId="job-cache" jobTitle="Senior Engineer" />,
    );
    expect(await screen.findByText("Candidate One")).toBeInTheDocument();
    firstRender.unmount();

    render(
      <CandidateRankingList jobId="job-cache" jobTitle="Senior Engineer" />,
    );
    expect(screen.getByText("Candidate One")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveRefresh?.(response(updatedPage));
      await refreshResponse;
    });
    expect(await screen.findByText("Candidate Updated")).toBeInTheDocument();
  });

  it("acknowledges the application when its detail drawer opens", async () => {
    const viewRequests: Array<{ url: string; method: string }> = [];
    let rankingRequestCount = 0;
    const detail = {
      applicationId: "app-1",
      humanDecisionNotice:
        "Scores support decision-making only. The recruiter makes the final decision.",
      scoring: {
        kind: "PROCESSING" as const,
        label: "Processing" as const,
        operationId: "operation-1",
      },
      rescoreInProgress: false,
      documentAccess: {
        cvViewerPath: "/cv",
        coverLetterViewerPath: "/cover-letter",
      },
    };
    const viewedPage = {
      ...page,
      items: [{ ...page.items[0], stage: "VIEWED" as const, stageVersion: 2 }],
    };
    const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/ranked?")) {
        rankingRequestCount += 1;
        return new Response(
          JSON.stringify(rankingRequestCount > 1 ? viewedPage : page),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      if (url.endsWith("/view")) {
        viewRequests.push({ url, method: init?.method ?? "GET" });
        return new Response(
          JSON.stringify({
            applicationId: "app-1",
            stage: "VIEWED",
            stageVersion: 2,
            lastStageChangedAt: "2026-08-18T06:22:00.000Z",
            changed: true,
          }),
          { status: 200 },
        );
      }
      if (url.endsWith("/scoring")) {
        return new Response(JSON.stringify(detail), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CandidateRankingList
        jobId="job-1"
        jobTitle="Senior Engineer"
        csrfProof="csrf-proof"
      />,
    );
    const candidate = await screen.findByText("Candidate One");
    const row = candidate.closest('[role="row"]');
    expect(row).not.toBeNull();
    fireEvent.click(row!);

    await waitFor(() => expect(viewRequests).toHaveLength(1));
    expect(viewRequests[0]).toMatchObject({ method: "POST" });
    expect(screen.getByRole("dialog")).toHaveAttribute(
      "aria-labelledby",
      "ai-ranking-drawer-title",
    );
  });

  it("shortlists a Viewed candidate from the detail drawer", async () => {
    const viewedPage = {
      ...page,
      items: [{ ...page.items[0], stage: "VIEWED" as const, stageVersion: 2 }],
    };
    const shortlistRequests: Array<{ url: string; method: string }> = [];
    const detail = {
      applicationId: "app-1",
      humanDecisionNotice:
        "Scores support decision-making only. The recruiter makes the final decision.",
      scoring: {
        kind: "PROCESSING" as const,
        label: "Processing" as const,
        operationId: "operation-1",
      },
      rescoreInProgress: false,
      documentAccess: {
        cvViewerPath: "/cv",
        coverLetterViewerPath: "/cover-letter",
      },
    };
    const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/ranked?")) {
        return new Response(JSON.stringify(viewedPage), { status: 200 });
      }
      if (url.endsWith("/shortlist")) {
        shortlistRequests.push({ url, method: init?.method ?? "GET" });
        return new Response(
          JSON.stringify({
            applicationId: "app-1",
            stage: "SHORTLISTED",
            stageVersion: 3,
            lastStageChangedAt: "2026-08-18T06:22:00.000Z",
            changed: true,
          }),
          { status: 200 },
        );
      }
      if (url.endsWith("/scoring")) {
        return new Response(JSON.stringify(detail), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CandidateRankingList
        jobId="job-1"
        jobTitle="Senior Engineer"
        csrfProof="csrf-proof"
      />,
    );
    const candidate = await screen.findByText("Candidate One");
    fireEvent.click(candidate.closest('[role="row"]')!);

    const shortlist = await screen.findByRole("button", { name: "Shortlist" });
    fireEvent.click(shortlist);
    await waitFor(() => expect(shortlistRequests).toHaveLength(1));
    expect(shortlistRequests[0]).toMatchObject({ method: "POST" });
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Shortlist" }),
      ).not.toBeInTheDocument(),
    );
  });
});
