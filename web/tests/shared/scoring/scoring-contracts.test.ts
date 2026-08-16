import { describe, expect, it } from "vitest";
import { aiAssessmentSchema, rankedApplicationPageSchema, scoringStateSchema } from "@/shared/contracts/scoring";
import { aiFixture, automaticFixture } from "../../backend/scoring/fixtures";

describe("scoring contract state unions", () => {
  it("keeps unavailable distinct from zero and scored", () => {
    const state = { kind: "UNAVAILABLE" as const, label: "Unavailable" as const, automaticMatch: automaticFixture(), aiAssessment: { kind: "UNAVAILABLE" as const, label: "Unavailable" as const, safeFailureCode: "AI_PROVIDER_UNAVAILABLE", supportGuidance: null }, finalScore: { kind: "NOT_CALCULATED" as const, label: "Not calculated" as const }, retryAllowed: true, consecutiveFailures: 1 };
    expect((scoringStateSchema.parse(state) as typeof state).finalScore).toEqual({ kind: "NOT_CALCULATED", label: "Not calculated" });
  });

  it("requires a compliance statement", () => {
    expect(aiAssessmentSchema.parse(aiFixture()).compliance.label).toBe("Sensitive personal attributes are excluded from scoring.");
    expect(() => aiAssessmentSchema.parse({ ...aiFixture(), compliance: { code: "OTHER", label: "Other" } })).toThrow();
  });

  it("keeps processing rows without a numeric final score", () => {
    const valid = {
      applicationId: "app-1", stage: "APPLIED", stageVersion: 1, submittedAt: "2026-08-15T00:00:00.000Z", candidate: { displayName: "A", verifiedEmail: "a@example.com", avatarUrl: null }, experienceYears: null, skills: [], scoring: { kind: "PROCESSING", label: "Processing", operationId: "op-1" }, scoreSummary: { automatic: null, ai: null, final: null, band: null }, manuallyPrioritized: false, manualPriority: null, allowedActions: { moveToInterview: { allowed: true, label: "Move" }, reject: { allowed: true, label: "Reject" } },
    };
    const page = { items: [valid], nextCursor: null, rankingSnapshotId: "snapshot-1", activeFilters: [], processingExcludedCount: 1, processingExclusionLabel: "1 candidates still processing are excluded from this score filter.", defaultRejectedExclusionLabel: null, rescoreInProgress: false, filteredCandidates: 1, totalCandidates: 1, summary: { total: 1, strong: 0, review: 0, low: 0, processing: 1 } };
    expect(rankedApplicationPageSchema.parse(page)).toBeDefined();
    expect(() => rankedApplicationPageSchema.parse({ ...page, items: [{ ...valid, scoreSummary: { ...valid.scoreSummary, final: 0 } }] })).toThrow();
  });
});
