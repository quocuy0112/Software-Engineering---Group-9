import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CvEvidence } from "@/frontend/features/cv-import/components/cv-evidence";

describe("Candidate OCR evidence", () => {
  it("labels source, confidence, and conflicts without relying on color", () => {
    render(
      <CvEvidence
        evidence={{
          confidence: 0.74,
          locations: ["pdf-page-2-ocr-1"],
          contextAvailable: false,
          context: null,
          sourceMethods: ["OCR"],
          sourceLocations: ["PDF page 2"],
          warnings: ["MATERIAL_NATIVE_OCR_CONFLICT"],
          reviewRequired: true,
        }}
      />,
    );
    fireEvent.click(screen.getByText("Data source details"));
    expect(screen.getByText("Source: PDF page 2")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "material native ocr conflict",
    );
  });
});
