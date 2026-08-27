import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { JobSearchResponse } from "@/shared/contracts/jobs/discovery";
import {
  LiveJobSearchExperience,
  type JobsLiveCopy,
} from "@/frontend/features/jobs/components/live-job-search-experience";

vi.mock("@/frontend/features/jobs/components/job-results-list", () => ({
  JobResultsList: ({ jobs }: { jobs: unknown[] }) => (
    <div data-testid="job-results">{jobs.length}</div>
  ),
}));

vi.mock("@/frontend/features/jobs/components/jobs-workspace", () => ({
  JobsWorkspaceNav: () => null,
}));

const copy: JobsLiveCopy = {
  locale: "en",
  kicker: "Smart Hire opportunities",
  title: "Jobs",
  intro: "Find work that fits.",
  jobs: "jobs",
  openRoles: "open roles",
  filters: "Job filters",
  results: "Search results",
  loadFailed: "Jobs could not be loaded",
  opportunities: "matching jobs",
  showing: "Showing",
  of: "of",
  tryAgain: "Please try again.",
  retry: "Try again",
  firstPage: "First page",
  previousPage: "Previous page",
  nextPage: "Next page",
  lastPage: "Last page",
  page: "Page",
  perPage: "Per page:",
  resultPages: "Job result pages",
  empty: "No jobs match these criteria",
  emptyCopy: "Try widening one or more criteria.",
  resetSearch: "Reset search",
  emptyPage: "No jobs on this page",
  emptyPageCopy: "Return to the first page to see the available results.",
  clear: "Clear filters",
};

function result(
  total: number,
  includeItems = total > 0,
  page = 1,
): JobSearchResponse {
  return {
    items: includeItems
      ? ([{ id: "job-1" }] as JobSearchResponse["items"])
      : [],
    total,
    nextCursor: null,
    page,
    totalPages: Math.max(1, Math.ceil(total / 20)),
    criteria: {},
  };
}

function response(total: number) {
  return {
    ok: true,
    json: async () => result(total, false),
  };
}

function renderExperience(
  initialResult = result(1),
  initialCriteria: Record<string, string | string[] | undefined> = {},
) {
  return render(
    <LiveJobSearchExperience
      initialCriteria={initialCriteria}
      initialResult={initialResult}
      initialError={null}
      copy={copy}
    />,
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/jobs");
});

describe("live job search experience", () => {
  it("keeps search scope implicit and only exposes result sorting", () => {
    renderExperience();

    expect(screen.queryByText("Search by:")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Job title" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Sort by:")).toBeVisible();
    expect(
      screen
        .getByRole("button", { name: /best match for your profile/i })
        .querySelector(".job-results-sort-chevron"),
    ).not.toBeNull();
  });

  it("renders a guided empty state for a true zero-result search", () => {
    renderExperience(result(0, false), { q: "nonexistent" });

    expect(
      screen.getByRole("heading", { name: "No jobs match these criteria" }),
    ).toBeVisible();
    expect(
      screen.getByText("Try widening one or more criteria."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Reset search" })).toBeVisible();
    expect(screen.queryByText("Sort by:")).not.toBeInTheDocument();
  });

  it("resets the search from the empty state", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(1));
    vi.stubGlobal("fetch", fetchMock);
    renderExperience(result(0, false), { q: "nonexistent" });

    fireEvent.click(screen.getByRole("button", { name: "Reset search" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/jobs?",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
    expect(window.location.pathname).toBe("/jobs");
  });

  it("does not describe an out-of-range page as a zero-match search", () => {
    renderExperience(result(21, false, 2), { q: "frontend" });

    expect(
      screen.getByRole("heading", { name: "No jobs on this page" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "First page" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "No jobs match these criteria" }),
    ).not.toBeInTheDocument();
  });

  it("keeps only the latest response when filters change quickly", async () => {
    let resolveFirst: ((value: ReturnType<typeof response>) => void) | null =
      null;
    const first = new Promise<ReturnType<typeof response>>((resolve) => {
      resolveFirst = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce(response(2));
    vi.stubGlobal("fetch", fetchMock);
    renderExperience();

    fireEvent.click(screen.getByLabelText("Full-time"));
    fireEvent.change(screen.getByLabelText("Work arrangement"), {
      target: { value: "REMOTE" },
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getAllByText("2 matching jobs").at(0)).toBeVisible(),
    );

    await act(async () => {
      resolveFirst?.(response(99));
      await Promise.resolve();
    });
    expect(screen.queryByText("99 matching jobs")).not.toBeInTheDocument();
  });
});
