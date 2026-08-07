import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ImageSearchConsent } from "@/frontend/features/jobs/image-search/components/image-search-consent";
import { ImageSearchInput } from "@/frontend/features/jobs/image-search/components/image-search-input";
import { ImageSearchProgress } from "@/frontend/features/jobs/image-search/components/image-search-progress";
import { ImageSearchProposals } from "@/frontend/features/jobs/image-search/components/image-search-proposals";
import { ImageSearchRecovery } from "@/frontend/features/jobs/image-search/components/image-search-recovery";
import { ImageSearchFeedback } from "@/frontend/features/jobs/image-search/components/image-search-feedback";
import { GlobalImageSearch } from "@/frontend/features/jobs/image-search/components/global-image-search";
import type { SearchIntent } from "@/shared/contracts/jobs/search-intent";

const toast = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("sonner", () => ({ toast }));

const intent: SearchIntent = {
  schemaVersion: "job-search-intent-v1",
  language: "EN",
  warnings: [],
  proposals: [
    {
      id: "occupation-1",
      field: "q",
      stringValue: "Digital Marketing Specialist",
      numberValue: null,
      stringValues: [],
      confidence: 0.82,
      basis: "INFERRED",
      evidence: [
        {
          startCodePoint: 15,
          endCodePoint: 34,
          text: "optimize paid media",
        },
      ],
      selected: false,
      selectionReason: "USER_SELECTION_REQUIRED",
    },
    {
      id: "remote-1",
      field: "workArrangement",
      stringValue: null,
      numberValue: null,
      stringValues: ["REMOTE"],
      confidence: 0.98,
      basis: "NORMALIZED",
      evidence: [{ startCodePoint: 0, endCodePoint: 6, text: "Remote" }],
      selected: true,
      selectionReason: "AUTO_NORMALIZED",
    },
    {
      id: "location-1",
      field: "location",
      stringValue: "Da Nang",
      numberValue: null,
      stringValues: [],
      confidence: 0.72,
      basis: "INFERRED",
      evidence: [{ startCodePoint: 7, endCodePoint: 14, text: "Da Nang" }],
      selected: false,
      selectionReason: "USER_SELECTION_REQUIRED",
    },
  ],
};

describe("image-assisted job-search controls", () => {
  it("keeps an English text-and-camera search bar available in the global header", () => {
    window.history.replaceState(null, "", "/jobs?q=Sidebar%20keyword");
    render(<GlobalImageSearch />);

    expect(
      screen.getByRole("search", { name: "Global job search" }),
    ).toBeVisible();
    expect(
      screen.getByPlaceholderText("Search jobs, skills, or companies"),
    ).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Search jobs from an image" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Search jobs" })).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "Search jobs from an image" }),
    );
    const file = screen.getByLabelText("Job poster image");
    expect(file).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(file).toBeEnabled();
    window.history.replaceState(null, "", "/");
  });

  it("accepts a PNG/JPEG file through the accessible labeled input", () => {
    const onSelect = vi.fn();
    render(<ImageSearchInput disabled={false} onSelect={onSelect} />);
    const file = new File([Buffer.from("image")], "poster.png", {
      type: "image/png",
    });
    fireEvent.change(screen.getByLabelText("Job poster image"), {
      target: { files: [file] },
    });
    expect(onSelect).toHaveBeenCalledWith(file);
    expect(screen.getByText(/up to 5 MB/u)).toBeVisible();
    expect(screen.getByText(/maximum 20 MP/u)).toBeVisible();
  });

  it("shows provenance and confidence while supporting edit, reverse, remove, and clear", () => {
    const onApply = vi.fn();
    render(
      <ImageSearchProposals
        intent={intent}
        onApply={onApply}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByText("High confidence")).toBeVisible();
    expect(screen.getAllByText("Review suggested")).toHaveLength(2);
    expect(
      screen.getByText(/This may be a “Digital Marketing Specialist” role/u),
    ).toBeVisible();
    expect(screen.getByText("Job title or keyword")).toBeVisible();
    expect(screen.getByText(/Source: Remote/u)).toBeVisible();
    fireEvent.change(screen.getByLabelText("Edit location proposal"), {
      target: { value: "Hanoi" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reverse selections" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Apply selected filters" }),
    );
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        proposals: expect.arrayContaining([
          expect.objectContaining({
            id: "location-1",
            stringValue: "Hanoi",
            selected: true,
          }),
        ]),
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove location" }));
    expect(
      screen.queryByLabelText("Edit location proposal"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear proposals" }));
    expect(
      screen.queryByLabelText("Edit workArrangement proposal"),
    ).not.toBeInTheDocument();
  });

  it("keeps cancel, manual fallback, and initially-off external consent explicit", () => {
    const cancel = vi.fn();
    const manual = vi.fn();
    const consent = vi.fn();
    const { rerender } = render(
      <>
        <ImageSearchConsent selected={false} onChange={consent} />
        <ImageSearchProgress progress={42} onCancel={cancel} />
        <ImageSearchRecovery
          error="OCR unavailable"
          fallbackReason={null}
          onRetry={vi.fn()}
          onManual={manual}
        />
      </>,
    );
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(consent).toHaveBeenCalledWith(true);
    expect(screen.getByRole("status")).toHaveTextContent("42%");
    fireEvent.click(
      screen.getByRole("button", { name: "Cancel image search" }),
    );
    expect(cancel).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Search manually" }));
    expect(manual).toHaveBeenCalledWith();

    rerender(
      <ImageSearchRecovery
        error={null}
        fallbackReason="INTERPRETER_UNAVAILABLE"
        onRetry={vi.fn()}
        onManual={manual}
      />,
    );
    expect(
      screen.getByRole("heading", {
        name: "AI filter suggestions are unavailable",
      }),
    ).toBeVisible();
    expect(
      screen.queryByLabelText("Recognized job poster text"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Use as keyword search" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Continue to Find jobs" }),
    );
    expect(manual).toHaveBeenLastCalledWith();
  });

  it("uses error, warning, and success toasts for image-search outcomes", () => {
    vi.clearAllMocks();
    const { rerender } = render(
      <ImageSearchFeedback
        phase="ERROR"
        error="Image search is temporarily unavailable."
        fallbackReason={null}
        retryAt={null}
        proposalCount={0}
        warningCount={0}
      />,
    );
    expect(toast.error).toHaveBeenCalledWith(
      "Image search could not continue",
      expect.objectContaining({
        description: "Image search is temporarily unavailable.",
      }),
    );

    rerender(
      <ImageSearchFeedback
        phase="FALLBACK"
        error={null}
        fallbackReason="INTERPRETER_UNAVAILABLE"
        retryAt={null}
        proposalCount={0}
        warningCount={0}
      />,
    );
    expect(toast.warning).toHaveBeenCalledWith(
      "AI filter suggestions are unavailable",
      expect.any(Object),
    );

    rerender(
      <ImageSearchFeedback
        phase="READY"
        error={null}
        fallbackReason={null}
        retryAt={null}
        proposalCount={2}
        warningCount={0}
      />,
    );
    expect(toast.success).toHaveBeenCalledWith(
      "Job filters are ready",
      expect.objectContaining({ description: expect.stringContaining("2") }),
    );
  });
});
