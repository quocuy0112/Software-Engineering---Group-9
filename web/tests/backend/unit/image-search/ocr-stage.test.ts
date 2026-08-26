import { describe, expect, it } from "vitest";

import { searchOcrRequiresReview } from "@/backend/image-search/workers/ocr-stage";

describe("image-search OCR review policy", () => {
  it("allows high-confidence partial OCR through to user-reviewed suggestions", () => {
    expect(
      searchOcrRequiresReview({ averageConfidence: 0.99, partial: true }),
    ).toBe(false);
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
