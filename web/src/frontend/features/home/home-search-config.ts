import { jobSearchQuerySchema } from "@/shared/contracts/jobs/discovery";

export type HomeSearchDraft = {
  keyword: string;
  location: string;
};

export const emptyHomeSearchDraft: HomeSearchDraft = {
  keyword: "",
  location: "",
};

export function buildHomeJobSearch(draft: HomeSearchDraft) {
  const parsed = jobSearchQuerySchema.parse({
    q: draft.keyword.trim(),
    location: draft.location.trim(),
  });
  const params = new URLSearchParams();
  if (parsed.q) params.set("q", parsed.q);
  if (parsed.location) params.set("location", parsed.location);
  return params;
}
