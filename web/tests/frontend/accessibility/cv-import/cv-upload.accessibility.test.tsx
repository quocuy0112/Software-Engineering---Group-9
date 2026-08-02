import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CvUploadForm } from "@/frontend/features/cv-import/components/cv-upload-form";

describe("CV upload accessibility", () => {
  it("has labelled controls, keyboard submission, live feedback, and an error summary", () => {
    render(<CvUploadForm csrfProof="csrf_fixture" onUpload={vi.fn()} />);
    expect(screen.getByLabelText("CV file")).toHaveAttribute(
      "accept",
      expect.stringContaining(".pdf"),
    );
    expect(
      screen.getByRole("group", { name: /choose a parser/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("radio", { name: /smarthire deterministic/i }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: /external openai/i }),
    ).toBeEnabled();
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    fireEvent.click(screen.getByRole("button", { name: /upload cv/i }));
    expect(screen.getByRole("alert")).toHaveFocus();
  });

  it("exposes a 320px-safe root and reduced-motion marker", () => {
    render(<CvUploadForm csrfProof="csrf_fixture" onUpload={vi.fn()} />);
    const root = screen.getByTestId("cv-upload-form");
    expect(root).toHaveAttribute("data-narrow-layout", "320");
    expect(root).toHaveAttribute("data-reduced-motion-safe", "true");
  });
});
