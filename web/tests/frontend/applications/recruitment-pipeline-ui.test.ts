import { describe, expect, it } from "vitest";
import type { PipelineApplicationCard } from "@/shared/contracts/applications";
import {
  filterPipelineCards,
  pipelineTierForCard,
  sortPipelineCards,
} from "@/frontend/features/recruiter-applications/recruitment-pipeline-ui";

function card(
  applicationId: string,
  displayName: string,
  score: PipelineApplicationCard["score"],
): PipelineApplicationCard {
  return {
    applicationId,
    candidate: { displayName, avatarUrl: null },
    submittedAt: "2026-08-18T00:00:00.000Z",
    stage: "APPLIED",
    stageVersion: 1,
    documents: { cvAvailable: false, coverLetterAvailable: false },
    score,
    allowedDestinations: ["VIEWED"],
    dragDestinations: ["VIEWED"],
  };
}

const bandLabels = {
  HIGH_MATCH: "Strong match",
  MEDIUM_MATCH: "Review needed",
  LOW_MATCH: "Low match",
} as const;

const scored = (final: number, band: keyof typeof bandLabels) => ({
  state: "SCORED" as const,
  final,
  aiScore: final,
  band: { code: band, label: bandLabels[band] },
  aiScoreBand: { code: band, label: bandLabels[band] },
});

describe("recruitment pipeline provisional UI utilities", () => {
  it("derives the display tier from the final score state and band", () => {
    expect(pipelineTierForCard(card("pending", "Pending", null))).toBe(
      "pending",
    );
    expect(
      pipelineTierForCard(card("strong", "Strong", scored(91, "HIGH_MATCH"))),
    ).toBe("strong");
    expect(
      pipelineTierForCard(card("review", "Review", scored(57, "MEDIUM_MATCH"))),
    ).toBe("review");
    expect(
      pipelineTierForCard(card("low", "Low", scored(22, "LOW_MATCH"))),
    ).toBe("low");
  });

  it("combines the local tier and name filters with AND semantics", () => {
    const cards = [
      card("strong-ada", "Ada Strong", scored(90, "HIGH_MATCH")),
      card("review-ada", "Ada Review", scored(60, "MEDIUM_MATCH")),
      card("strong-bea", "Bea Strong", scored(90, "HIGH_MATCH")),
    ];

    expect(
      filterPipelineCards(cards, "strong", "ada").map(
        (item) => item.applicationId,
      ),
    ).toEqual(["strong-ada"]);
  });

  it("sorts each loaded subset by score while keeping pending cards last", () => {
    const cards = [
      card("pending", "Pending", null),
      card("low", "Low", scored(20, "LOW_MATCH")),
      card("high", "High", scored(90, "HIGH_MATCH")),
    ];

    expect(
      sortPipelineCards(cards, "asc").map((item) => item.applicationId),
    ).toEqual(["low", "high", "pending"]);
    expect(
      sortPipelineCards(cards, "desc").map((item) => item.applicationId),
    ).toEqual(["high", "low", "pending"]);
    expect(
      sortPipelineCards(cards, "none").map((item) => item.applicationId),
    ).toEqual(["pending", "low", "high"]);
  });
});
