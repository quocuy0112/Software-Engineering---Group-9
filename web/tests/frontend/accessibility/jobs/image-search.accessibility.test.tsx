import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ImageSearchPrivacyNotice } from "@/frontend/features/jobs/image-search/components/image-search-privacy-notice";
import { ImageSearchProgress } from "@/frontend/features/jobs/image-search/components/image-search-progress";
import { ImageSearchRecovery } from "@/frontend/features/jobs/image-search/components/image-search-recovery";

describe("image-assisted search accessibility", () => {
  it("announces progress and recovery without relying on color", () => {
    render(
      <>
        <ImageSearchPrivacyNotice />
        <ImageSearchProgress progress={65} onCancel={vi.fn()} />
        <ImageSearchRecovery
          error="The image could not be read."
          fallbackText={null}
          onRetry={vi.fn()}
          onManual={vi.fn()}
        />
      </>,
    );
    expect(screen.getByRole("note")).toHaveTextContent(
      /not used for face, identity, protected-attribute, or candidate analysis/u,
    );
    expect(screen.getByRole("status")).toHaveAccessibleName(
      "Processing job image",
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "65");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Ordinary text search is still available.",
    );
    expect(
      screen.getByRole("button", { name: "Search manually" }),
    ).toBeEnabled();
  });
});
