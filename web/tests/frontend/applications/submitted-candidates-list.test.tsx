import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SubmittedCandidatesList } from "@/frontend/features/recruiter-applications/submitted-candidates-list";
import { applicationPageFixture, submittedCandidateFixture } from "../../helpers/application-fixture";

describe("submitted candidates list", () => {
  it("renders approved contact fields, document actions, and load-more without scores", async () => {
    const first = submittedCandidateFixture();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => applicationPageFixture([first], "cursor-2"),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SubmittedCandidatesList jobId="job-1" jobTitle="Senior Engineer" />);

    expect(await screen.findByText("Nguyen Minh Anh")).toBeInTheDocument();
    expect(screen.getByText("anh@example.test")).toBeInTheDocument();
    expect(screen.getByText("+84 90 000 0000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view cv/i })).toBeEnabled();
    expect(screen.getByRole("link", { name: /download cv/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/documents/cv/download"),
    );
    expect(screen.queryByRole("button", { name: /score|rank/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /load more candidates/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]?.[0]).toContain("cursor=cursor-2");
    vi.unstubAllGlobals();
  });

  it("keeps a successful empty page distinct from a failed request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => applicationPageFixture([], null),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<SubmittedCandidatesList jobId="job-empty" jobTitle="Designer" />);
    expect(await screen.findByText(/no candidates have applied/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
