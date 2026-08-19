import type {
  ApplicationStage,
  PipelineApplicationCard,
} from "@/shared/contracts/applications";

export type PipelineTier = "strong" | "review" | "low" | "pending";
export type PipelineTierFilter = PipelineTier | "all";
export type PipelineSortDirection = "none" | "asc" | "desc";

const sortablePipelineStages = new Set<ApplicationStage>([
  "APPLIED",
  "VIEWED",
  "SHORTLISTED",
  "INTERVIEWING",
]);

export function canSortPipelineStage(stage: ApplicationStage) {
  return sortablePipelineStages.has(stage);
}

/**
 * This is a display mapping only. `pending` means that the server projection
 * does not contain a scored final result; it is not a new persisted tier.
 */
export function pipelineTierForCard(
  card: PipelineApplicationCard,
): PipelineTier {
  if (
    !card.score ||
    card.score.state !== "SCORED" ||
    card.score.final === null ||
    !card.score.band
  ) {
    return "pending";
  }

  switch (card.score.band.code) {
    case "HIGH_MATCH":
      return "strong";
    case "MEDIUM_MATCH":
      return "review";
    case "LOW_MATCH":
      return "low";
  }
}

export function pipelineScoreForCard(card: PipelineApplicationCard) {
  return card.score?.state === "SCORED" && card.score.final !== null
    ? card.score.final
    : null;
}

export function filterPipelineCards(
  cards: readonly PipelineApplicationCard[],
  filter: PipelineTierFilter,
  query: string,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return cards.filter((card) => {
    const matchesTier =
      filter === "all" || pipelineTierForCard(card) === filter;
    const matchesQuery =
      !normalizedQuery ||
      card.candidate.displayName.toLocaleLowerCase().includes(normalizedQuery);
    return matchesTier && matchesQuery;
  });
}

export function sortPipelineCards(
  cards: readonly PipelineApplicationCard[],
  direction: PipelineSortDirection,
) {
  if (direction === "none") return [...cards];

  return cards
    .map((card, index) => ({ card, index, score: pipelineScoreForCard(card) }))
    .sort((left, right) => {
      const leftPending = left.score === null;
      const rightPending = right.score === null;
      if (leftPending && rightPending) return left.index - right.index;
      if (leftPending) return 1;
      if (rightPending) return -1;
      if (left.score === right.score) return left.index - right.index;
      return direction === "asc"
        ? left.score! - right.score!
        : right.score! - left.score!;
    })
    .map(({ card }) => card);
}
