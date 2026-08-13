import { describe, expect, it } from "vitest";
import {
  careerPaths,
  eventItems,
  feedItems,
  growthItems,
} from "@/frontend/features/home/home-display-data";

describe("Home display fixtures", () => {
  it("keeps bilingual community content bounded and non-social", () => {
    for (const locale of ["vi", "en"] as const) {
      expect(feedItems[locale]).toHaveLength(3);
      expect(feedItems[locale].map((item) => item.type)).toEqual([
        "career",
        "hiring",
        "guidance",
      ]);
      expect(careerPaths[locale]).toHaveLength(6);
      expect(growthItems[locale]).toHaveLength(4);
      expect(eventItems[locale]).toHaveLength(4);
      expect(JSON.stringify(feedItems[locale])).not.toMatch(
        /like|comment|share/i,
      );
    }
  });
});
