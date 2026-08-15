import { describe, expect, it } from "vitest";
import { assertCompatibleLineage, calculateHybridScore } from "@/backend/scoring/domain/hybrid-score-calculator";
import { aiFixture, automaticFixture } from "./fixtures";

describe("hybrid score", () => {
  it("uses one fixed 60/40 rounding step and explicit provenance", () => {
    const result = calculateHybridScore({ automatic: automaticFixture(), ai: aiFixture(), computedAt: new Date("2026-08-15T00:00:00.000Z") });
    expect(result.value).toBe(90.4);
    expect(result.formulaText).toContain("0.6");
    expect(result.formulaText).toContain("90.4");
    expect(result.band).toMatchObject({ code: "HIGH_MATCH", label: "Strong match" });
    expect(result.computedAt).toBe("2026-08-15T00:00:00.000Z");
  });

  it("rejects mismatched document lineage before publication", () => {
    expect(() => assertCompatibleLineage(automaticFixture(), { cvVersion: "CV-v2", jdVersion: "JD-v3", configVersion: "HS-60/40-v1" })).toThrow("INCOMPATIBLE_SCORE_LINEAGE");
  });
});
