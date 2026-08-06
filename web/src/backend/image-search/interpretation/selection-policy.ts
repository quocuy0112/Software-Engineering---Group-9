import "server-only";

import {
  employmentTypeSchema,
  experienceLevelSchema,
  workArrangementSchema,
} from "@/shared/contracts/jobs/discovery";
import type { ManualSearchContext } from "@/shared/contracts/jobs/image-search";
import {
  IMAGE_SEARCH_ALLOWED_FIELDS,
  searchIntentSchema,
  type SearchIntent,
} from "@/shared/contracts/jobs/search-intent";
import {
  rawIntentProposalSchema,
  type RawIntentProposal,
} from "./search-intent-interpreter";

const setFields = new Set([
  "employmentType",
  "experienceLevel",
  "workArrangement",
  "skills",
]);
const numericFields = new Set(["salaryMin", "salaryMax", "postedWithinDays"]);

function carrierValid(proposal: RawIntentProposal) {
  if (!IMAGE_SEARCH_ALLOWED_FIELDS.includes(proposal.field)) return false;
  if (numericFields.has(proposal.field))
    return (
      proposal.numberValue !== null &&
      proposal.stringValue === null &&
      proposal.stringValues.length === 0
    );
  if (setFields.has(proposal.field))
    return (
      proposal.stringValues.length > 0 &&
      proposal.stringValue === null &&
      proposal.numberValue === null
    );
  return (
    proposal.stringValue !== null &&
    proposal.numberValue === null &&
    proposal.stringValues.length === 0
  );
}

function valuesValid(proposal: RawIntentProposal) {
  if (proposal.field === "employmentType")
    return proposal.stringValues.every(
      (value) => employmentTypeSchema.safeParse(value).success,
    );
  if (proposal.field === "experienceLevel")
    return proposal.stringValues.every(
      (value) => experienceLevelSchema.safeParse(value).success,
    );
  if (proposal.field === "workArrangement")
    return proposal.stringValues.every(
      (value) => workArrangementSchema.safeParse(value).success,
    );
  if (proposal.field === "salaryCurrency")
    return /^[A-Z]{3}$/u.test(proposal.stringValue ?? "");
  if (proposal.field === "salaryPeriod")
    return ["HOUR", "MONTH", "YEAR"].includes(proposal.stringValue ?? "");
  if (proposal.field === "postedWithinDays")
    return [1, 3, 7, 14, 30].includes(proposal.numberValue ?? -1);
  return true;
}

function valueKey(proposal: RawIntentProposal) {
  return `${proposal.field}:${proposal.stringValue ?? ""}:${proposal.numberValue ?? ""}:${proposal.stringValues.join("|")}`.toLocaleLowerCase(
    "vi",
  );
}

export class SearchIntentSelectionPolicy {
  validateAndSelect(input: {
    ocrText: string;
    language: SearchIntent["language"];
    proposals: readonly RawIntentProposal[];
  }): SearchIntent {
    const codePoints = Array.from(input.ocrText);
    const warnings = new Set<SearchIntent["warnings"][number]>();
    const accepted: SearchIntent["proposals"] = [];
    const seen = new Set<string>();
    for (const candidate of input.proposals) {
      const parsed = rawIntentProposalSchema.safeParse(candidate);
      if (
        !parsed.success ||
        !carrierValid(candidate) ||
        !valuesValid(candidate)
      ) {
        warnings.add("UNSUPPORTED_CRITERIA_REMOVED");
        continue;
      }
      if (candidate.confidence < 0.6) {
        warnings.add("LOW_CONFIDENCE_CRITERIA_REMOVED");
        continue;
      }
      const evidence = candidate.evidence.map((range) => ({
        ...range,
        text: codePoints
          .slice(range.startCodePoint, range.endCodePoint)
          .join(""),
      }));
      if (
        evidence.some(
          (item) =>
            item.startCodePoint < 0 ||
            item.endCodePoint > codePoints.length ||
            item.endCodePoint <= item.startCodePoint ||
            !item.text.trim(),
        )
      ) {
        warnings.add("UNVERIFIED_EVIDENCE_REMOVED");
        continue;
      }
      const key = valueKey(candidate);
      if (seen.has(key)) continue;
      seen.add(key);
      if (accepted.length >= 20) {
        warnings.add("EXCESS_CRITERIA_REMOVED");
        continue;
      }
      const selected =
        candidate.confidence >= 0.9 && candidate.basis !== "INFERRED";
      accepted.push({
        ...candidate,
        evidence,
        selected,
        selectionReason: selected
          ? candidate.basis === "EXPLICIT"
            ? "AUTO_EXPLICIT"
            : "AUTO_NORMALIZED"
          : "USER_SELECTION_REQUIRED",
      });
    }
    const minimum = accepted.find(
      (item) => item.field === "salaryMin",
    )?.numberValue;
    const maximum = accepted.find(
      (item) => item.field === "salaryMax",
    )?.numberValue;
    const proposals =
      minimum !== undefined &&
      minimum !== null &&
      maximum !== undefined &&
      maximum !== null &&
      minimum > maximum
        ? accepted.filter(
            (item) => !["salaryMin", "salaryMax"].includes(item.field),
          )
        : accepted;
    if (proposals.length !== accepted.length)
      warnings.add("CONTRADICTORY_CRITERIA_REMOVED");
    return searchIntentSchema.parse({
      schemaVersion: "job-search-intent-v1",
      language: input.language,
      proposals,
      warnings: [...warnings],
    });
  }

  mergeForDelivery(input: {
    intent: SearchIntent;
    currentCriteria: ManualSearchContext;
  }): SearchIntent {
    const warnings = new Set(input.intent.warnings);
    const scalarHasManualValue = (field: string) => {
      if (field === "q" || field === "location")
        return Boolean(input.currentCriteria[field].trim());
      if (field === "salaryMin" || field === "salaryMax")
        return input.currentCriteria[field] !== null;
      if (field === "postedWithinDays")
        return input.currentCriteria.postedWithinDays !== null;
      if (field === "salaryCurrency")
        return input.currentCriteria.salaryCurrency !== "VND";
      if (field === "salaryPeriod")
        return input.currentCriteria.salaryPeriod !== "MONTH";
      return false;
    };
    const proposals = input.intent.proposals.flatMap((proposal) => {
      if (setFields.has(proposal.field)) {
        const existing = new Set(
          (
            input.currentCriteria[
              proposal.field as keyof ManualSearchContext
            ] as readonly string[]
          ).map((value) => value.toLocaleLowerCase("vi")),
        );
        const values = proposal.stringValues.filter(
          (value) => !existing.has(value.toLocaleLowerCase("vi")),
        );
        return values.length ? [{ ...proposal, stringValues: values }] : [];
      }
      if (!scalarHasManualValue(proposal.field)) return [proposal];
      warnings.add("MANUAL_VALUE_PRESERVED");
      return [
        {
          ...proposal,
          selected: false,
          selectionReason: "MANUAL_VALUE_CONFLICT" as const,
        },
      ];
    });
    return searchIntentSchema.parse({
      ...input.intent,
      proposals,
      warnings: [...warnings],
    });
  }
}
