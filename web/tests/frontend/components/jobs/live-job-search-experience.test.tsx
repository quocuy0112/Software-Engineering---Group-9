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
  empty: "No jobs match these criteria",
  emptyCopy: "Try widening one or more criteria.",
  clear: "Clear filters",
};

function result(total: number): JobSearchResponse {
  return {
    items: [],
    total,
    nextCursor: null,
    page: 1,
    totalPages: 1,
    criteria: {},
  };
}

function response(total: number) {
  return {
    ok: true,
    json: async () => result(total),
  };
}

function renderExperience(initialResult = result(1)) {
  return render(
    <LiveJobSearchExperience
      initialCriteria={{}}
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
  it("debounces text input and synchronizes the filter to the URL", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(response(3));
    vi.stubGlobal("fetch", fetchMock);
    renderExperience();

    fireEvent.change(screen.getByLabelText("Keywords"), {
      target: { value: "React" },
    });
    expect(window.location.search).toBe("?q=React");
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(399);
    });
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/jobs?q=React",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.getAllByText("3 matching jobs").at(0)).toBeVisible();
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

    fireEvent.change(screen.getByLabelText("Employment type"), {
      target: { value: "FULL_TIME" },
    });
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
