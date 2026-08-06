import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ImageSearchConsent } from "@/frontend/features/jobs/image-search/components/image-search-consent";
import { ImageSearchInput } from "@/frontend/features/jobs/image-search/components/image-search-input";
import { ImageSearchProgress } from "@/frontend/features/jobs/image-search/components/image-search-progress";
import { ImageSearchProposals } from "@/frontend/features/jobs/image-search/components/image-search-proposals";
import { ImageSearchRecovery } from "@/frontend/features/jobs/image-search/components/image-search-recovery";
import type { SearchIntent } from "@/shared/contracts/jobs/search-intent";

const intent: SearchIntent = {
  schemaVersion: "job-search-intent-v1",
  language: "EN",
  warnings: [],
  proposals: [
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
    expect(screen.getByText(/up to 5 MB and 20 megapixels/u)).toBeVisible();
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
    expect(screen.getByText("Review suggested")).toBeVisible();
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
          fallbackText={null}
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
        fallbackText="Senior TypeScript remote"
        onRetry={vi.fn()}
        onManual={manual}
      />,
    );
    expect(screen.getByLabelText("Recognized job poster text")).toHaveValue(
      "Senior TypeScript remote",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Use as keyword search" }),
    );
    expect(manual).toHaveBeenLastCalledWith("Senior TypeScript remote");
  });
});
