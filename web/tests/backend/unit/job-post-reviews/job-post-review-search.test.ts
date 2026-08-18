import { describe, expect, it } from "vitest";
import {
  normalizedReviewTitleSearch,
  reviewSearchTokens,
} from "@/backend/jobs/review/job-post-review-search";

describe("administrator job-post review search", () => {
  it.each(["web", "Web", "WEB", "Web De", "  Web   De  "])(
    "normalizes %s into title-search tokens",
    (query) => {
      const title = normalizedReviewTitleSearch("Web Developer");
      expect(
        reviewSearchTokens(query).every((token) => title.includes(token)),
      ).toBe(true);
    },
  );
});
