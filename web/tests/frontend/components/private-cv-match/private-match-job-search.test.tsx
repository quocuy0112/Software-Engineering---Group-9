import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrivateMatchSetup } from "@/frontend/features/private-cv-match/components/private-match-setup";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock(
  "@/frontend/features/private-cv-match/client/use-private-cv-match",
  () => ({
    privateMatchErrorMessage: () => "Request failed",
    useCreatePrivateCvMatch: () => ({
      isError: false,
      isPending: false,
      mutateAsync: vi.fn(),
    }),
  }),
);
vi.mock(
  "@/frontend/features/authentication/client/csrf-proof-context",
  () => ({ useCsrfProof: () => null }),
);
vi.mock(
  "@/frontend/features/authentication/client/current-csrf-proof",
  () => ({ mutateWithCurrentCsrf: vi.fn() }),
);
vi.mock(
  "@/frontend/features/dashboard/client/workspace-locale",
  () => ({ useWorkspaceLocale: () => "en" }),
);

const jobs = [
  {
    jobId: "job-1",
    slug: "platform-engineer",
    title: "Platform Engineer",
    company: "SmartHire",
    location: "Remote",
    employmentType: "FULL_TIME",
    workArrangement: "REMOTE",
    requiredExperienceYears: 3,
    requirements: ["TypeScript"],
  },
] as const;

const cvs = [
  {
    id: "cv-1",
    displayName: "Current CV",
    fileName: "current.pdf",
    mimeType: "application/pdf" as const,
    byteSize: 1_024,
    version: 1,
    confirmedAt: "2026-08-20T00:00:00.000Z",
    pageCount: 1,
    parseStatus: "READY" as const,
  },
] as const;

describe("PrivateMatchSetup job search", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps an error distinct from an empty result and retries the same query", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                ...jobs[0],
                jdVersion: 1,
                jdUpdatedAt: "2026-08-20T00:00:00.000Z",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<PrivateMatchSetup jobs={jobs} cvs={cvs} />);
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "platform" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
      await Promise.resolve();
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "We could not search jobs right now",
    );
    expect(screen.queryByText("No eligible jobs match that keyword or company.")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
      await Promise.resolve();
    });
    expect(screen.getAllByText("Platform Engineer")).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
