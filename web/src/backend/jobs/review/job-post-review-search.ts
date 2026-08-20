import "server-only";
import { normalizeSearchText } from "@/backend/services/jobs/search-normalization";

export function normalizedReviewTitleSearch(title: string) {
  return normalizeSearchText(title, 200);
}

export function reviewSearchTokens(value: string) {
  return normalizeSearchText(value, 160).split(" ").filter(Boolean).slice(0, 8);
}
