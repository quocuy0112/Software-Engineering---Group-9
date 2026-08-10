import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CvEvidence } from "@/frontend/features/cv-import/components/cv-evidence";

describe("Candidate OCR review accessibility", () => {
  it("exposes a textual alert and an explicit source label", () => {
    render(
      <CvEvidence
        evidence={{
          confidence: 0.4,
          locations: ["docx-image-1-ocr-1"],
          contextAvailable: false,
          context: null,
          sourceMethods: ["OCR"],
          sourceLocations: ["DOCX body 3, image 1"],
          warnings: ["LOW_CONFIDENCE", "APPROXIMATE_ANCHOR"],
          reviewRequired: true,
        }}
      />,
    );
    expect(
      screen.getByRole("alert", { name: "Recognized text requires review" }),
    ).toBeVisible();
    fireEvent.click(screen.getByText("Data source details"));
    expect(screen.getByText(/DOCX body 3/u)).toBeVisible();
  });
});
