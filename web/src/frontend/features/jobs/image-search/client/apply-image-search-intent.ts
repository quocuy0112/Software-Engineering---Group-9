import type { ManualSearchContext } from "@/shared/contracts/jobs/image-search";
import type { SearchIntent } from "@/shared/contracts/jobs/search-intent";

export function applyImageSearchIntent(
  current: ManualSearchContext,
  intent: SearchIntent,
) {
  const next: ManualSearchContext = structuredClone(current);
  const appliedScalarFields = new Set<string>();
  const replacedSetFields = new Set<string>();
  for (const proposal of intent.proposals.filter((item) => item.selected)) {
    if (proposal.field === "q" || proposal.field === "location") {
      if (!appliedScalarFields.has(proposal.field)) {
        next[proposal.field] = proposal.stringValue ?? "";
        appliedScalarFields.add(proposal.field);
      }
    } else if (
      proposal.field === "employmentType" ||
      proposal.field === "experienceLevel" ||
      proposal.field === "workArrangement" ||
      proposal.field === "skills"
    ) {
      if (!replacedSetFields.has(proposal.field)) {
        next[proposal.field] = [] as never;
        replacedSetFields.add(proposal.field);
      }
      const existing = new Set(
        next[proposal.field].map((value) => value.toLocaleLowerCase("vi")),
      );
      next[proposal.field] = [
        ...next[proposal.field],
        ...proposal.stringValues.filter(
          (value) => !existing.has(value.toLocaleLowerCase("vi")),
        ),
      ] as never;
    } else if (
      proposal.field === "salaryMin" ||
      proposal.field === "salaryMax"
    ) {
      if (!appliedScalarFields.has(proposal.field)) {
        next[proposal.field] = proposal.numberValue;
        appliedScalarFields.add(proposal.field);
      }
    } else if (proposal.field === "postedWithinDays") {
      if (!appliedScalarFields.has(proposal.field)) {
        next.postedWithinDays = proposal.numberValue as 1 | 3 | 7 | 14 | 30;
        appliedScalarFields.add(proposal.field);
      }
    } else if (proposal.field === "salaryCurrency") {
      if (!appliedScalarFields.has(proposal.field)) {
        next.salaryCurrency = proposal.stringValue ?? next.salaryCurrency;
        appliedScalarFields.add(proposal.field);
      }
    } else if (proposal.field === "salaryPeriod") {
      if (!appliedScalarFields.has(proposal.field)) {
        next.salaryPeriod =
          (proposal.stringValue as ManualSearchContext["salaryPeriod"]) ??
          next.salaryPeriod;
        appliedScalarFields.add(proposal.field);
      }
    }
  }
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (Array.isArray(value))
      value.forEach((item) => parameters.append(key, item));
    else if (value !== null && value !== "") parameters.set(key, String(value));
  }
  return `/jobs?${parameters.toString()}`;
}
