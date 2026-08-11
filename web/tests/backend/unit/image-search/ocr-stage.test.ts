import { describe, expect, it } from "vitest";

import { searchOcrRequiresReview } from "@/backend/image-search/workers/ocr-stage";

describe("image-search OCR review policy", () => {
  it("blocks partial OCR from interpretation even when confidence is high", () => {
    expect(
      searchOcrRequiresReview({ averageConfidence: 0.99, partial: true }),
    ).toBe(true);
  });

  it("requires review for low confidence and accepts complete high-confidence OCR", () => {
    expect(
      searchOcrRequiresReview({ averageConfidence: 0.59, partial: false }),
    ).toBe(true);
    expect(
      searchOcrRequiresReview({ averageConfidence: 0.6, partial: false }),
    ).toBe(false);
  });
});
