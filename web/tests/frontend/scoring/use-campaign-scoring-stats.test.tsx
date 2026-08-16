import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RecruiterJob } from "@/shared/contracts/recruiter-job-posting";
import { useCampaignScoringStats } from "@/frontend/features/recruiter-applications/use-campaign-scoring-stats";

const job = {
  id: "job-1",
  title: "Product Designer",
  status: "active",
  updatedAt: "2026-08-15T00:00:00.000Z",
  stats: { viewCount: 4, applicantCount: 1 },
  companyId: "company-1",
  company: { name: "Northstar Labs" },
  categoryFamily: "Design",
  industry: "Technology",
  description: { generalInfo: { department: "Design" } },
} as unknown as RecruiterJob;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useCampaignScoringStats refresh lifecycle", () => {
  it("diffs refreshed campaign and scoring data without replacing unchanged state", async () => {
    let applicantCount = 1;
    let strongCount = 1;
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url === "/api/recruiter/job-postings") {
          return new Response(
            JSON.stringify({
              jobs: [{ ...job, stats: { viewCount: 4, applicantCount } }],
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            stats: {
              "job-1": {
                total: applicantCount,
                strong: strongCount,
                review: 0,
                low: 0,
                processing: 0,
              },
            },
          }),
          { status: 200 },
        );
      });

    const { result } = renderHook(() => useCampaignScoringStats([job]));
    await waitFor(() => expect(result.current.lastUpdatedAt).not.toBeNull());
    expect(fetch).toHaveBeenCalledTimes(2);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const initialJobReference = result.current.jobs[0];
    const initialStatsReference = result.current.stats["job-1"];

    applicantCount = 2;
    strongCount = 2;
    await act(async () => {
      await result.current.refresh("manual");
    });

    expect(fetch).toHaveBeenCalledTimes(4);
    expect(result.current.jobs[0]).not.toBe(initialJobReference);
    expect(result.current.stats["job-1"]).not.toBe(initialStatsReference);
    expect(result.current.jobs[0]?.stats.applicantCount).toBe(2);
    expect(result.current.stats["job-1"]?.strong).toBe(2);
    expect(result.current.changedJobIds.has("job-1")).toBe(true);
  });

  it("batches scoring requests when the recruiter can access more than 100 jobs", async () => {
    const jobs = Array.from({ length: 101 }, (_, index) => ({
      ...job,
      id: `job-${index + 1}`,
    }));
    const scoringRequests: string[][] = [];
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url === "/api/recruiter/job-postings") {
          return new Response(JSON.stringify({ jobs }), { status: 200 });
        }

        const jobIds =
          new URL(url, "http://localhost").searchParams
            .get("jobIds")
            ?.split(",")
            .filter(Boolean) ?? [];
        scoringRequests.push(jobIds);
        return new Response(
          JSON.stringify({
            stats: Object.fromEntries(
              jobIds.map((jobId) => [
                jobId,
                {
                  total: 1,
                  strong: 0,
                  review: 0,
                  low: 1,
                  processing: 0,
                },
              ]),
            ),
          }),
          { status: 200 },
        );
      });

    const { result } = renderHook(() => useCampaignScoringStats([]));
    await waitFor(() => expect(result.current.lastUpdatedAt).not.toBeNull());

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(scoringRequests).toHaveLength(2);
    expect(scoringRequests.every((batch) => batch.length <= 100)).toBe(true);
    expect(result.current.stats["job-101"]?.low).toBe(1);
  });
});
