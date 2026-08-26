import { describe, expect, it } from "vitest";
import { assertCompatibleLineage, calculateHybridScore } from "@/backend/scoring/domain/hybrid-score-calculator";
import { aiFixture, automaticFixture } from "./fixtures";

describe("hybrid score", () => {
  it("uses one fixed 40/60 rounding step and explicit provenance", () => {
    const result = calculateHybridScore({ automatic: automaticFixture(), ai: aiFixture(), computedAt: new Date("2026-08-15T00:00:00.000Z") });
    expect(result.value).toBe(89.6);
    expect(result.formulaText).toContain("40%");
    expect(result.formulaText).toContain("89.6");
    expect(result.band).toMatchObject({ code: "HIGH_MATCH", label: "Strong match" });
    expect(result.computedAt).toBe("2026-08-15T00:00:00.000Z");
  });

  it("rejects mismatched document lineage before publication", () => {
    expect(() => assertCompatibleLineage(automaticFixture(), { cvVersion: "CV-v2", jdVersion: "JD-v3", configVersion: "HS-40/60-v1" })).toThrow("INCOMPATIBLE_SCORE_LINEAGE");
  });
});
