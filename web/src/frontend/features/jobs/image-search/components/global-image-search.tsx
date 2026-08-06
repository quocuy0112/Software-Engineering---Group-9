"use client";

import { useMemo, useState } from "react";

import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import type { ManualSearchContext } from "@/shared/contracts/jobs/image-search";
import { applyImageSearchIntent } from "../client/apply-image-search-intent";
import { useImageSearch } from "../client/use-image-search";
import { ImageSearchInput } from "./image-search-input";
import { ImageSearchPrivacyNotice } from "./image-search-privacy-notice";
import { ImageSearchProgress } from "./image-search-progress";
import { ImageSearchProposals } from "./image-search-proposals";
import { ImageSearchRecovery } from "./image-search-recovery";
import { ImageSearchConsent } from "./image-search-consent";

const defaults: ManualSearchContext = {
  q: "",
  location: "",
  employmentType: [],
  experienceLevel: [],
  workArrangement: [],
  skills: [],
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: "VND",
  salaryPeriod: "MONTH",
  postedWithinDays: null,
  sort: "RELEVANCE",
};

function criteriaFromLocation(): ManualSearchContext {
  if (typeof window === "undefined") return defaults;
  const value = new URL(window.location.href).searchParams;
  const enumValues = <T extends string>(name: string, allowed: readonly T[]) =>
    value.getAll(name).filter((item): item is T => allowed.includes(item as T));
  const number = (name: string) => {
    const raw = value.get(name);
    return raw !== null && /^\d+(?:\.\d+)?$/u.test(raw) ? Number(raw) : null;
  };
  const posted = number("postedWithinDays");
  return {
    q: value.get("q")?.slice(0, 200) ?? "",
    location: value.get("location")?.slice(0, 160) ?? "",
    employmentType: enumValues("employmentType", [
      "FULL_TIME",
      "PART_TIME",
      "CONTRACT",
      "INTERNSHIP",
      "TEMPORARY",
    ]),
    experienceLevel: enumValues("experienceLevel", [
      "ENTRY",
      "JUNIOR",
      "MID",
      "SENIOR",
      "LEAD",
      "MANAGER",
    ]),
    workArrangement: enumValues("workArrangement", [
      "ONSITE",
      "HYBRID",
      "REMOTE",
    ]),
    skills: [
      ...new Set(
        value
          .getAll("skills")
          .filter(Boolean)
          .map((item) => item.slice(0, 80)),
      ),
    ].slice(0, 20),
    salaryMin: number("salaryMin"),
    salaryMax: number("salaryMax"),
    salaryCurrency: /^[A-Z]{3}$/u.test(value.get("salaryCurrency") ?? "")
      ? value.get("salaryCurrency")!
      : "VND",
    salaryPeriod:
      enumValues("salaryPeriod", ["HOUR", "MONTH", "YEAR"])[0] ?? "MONTH",
    postedWithinDays: [1, 3, 7, 14, 30].includes(posted ?? -1)
      ? (posted as 1 | 3 | 7 | 14 | 30)
      : null,
    sort:
      enumValues("sort", ["RELEVANCE", "NEWEST", "SALARY_DESC"])[0] ??
      "RELEVANCE",
  };
}

export function GlobalImageSearch() {
  const csrfProof = useCsrfProof();
  const criteria = useMemo(() => criteriaFromLocation(), []);
  const [externalConsent, setExternalConsent] = useState(false);
  const search = useImageSearch({
    currentCriteria: criteria,
    csrfProof,
    externalInterpretation: externalConsent,
  });
  const busy = search.phase === "UPLOADING" || search.phase === "PROCESSING";
  return (
    <aside
      id="global-image-search"
      className="global-image-search"
      aria-label="Search jobs from an image"
    >
      <details open={search.phase !== "IDLE"}>
        <summary>Search jobs from a poster image</summary>
        <div className="global-image-search-panel">
          <ImageSearchPrivacyNotice />
          <ImageSearchConsent
            selected={externalConsent}
            onChange={(selected) => {
              if (!selected && busy) void search.revokeConsent();
              setExternalConsent(selected);
            }}
          />
          <ImageSearchInput
            disabled={busy}
            onSelect={(file) => void search.start(file)}
          />
          {busy ? (
            <ImageSearchProgress
              progress={search.progress}
              onCancel={() => void search.cancel()}
            />
          ) : null}
          {search.intent ? (
            <ImageSearchProposals
              intent={search.intent}
              onClear={search.clear}
              onApply={(intent) =>
                window.location.assign(applyImageSearchIntent(criteria, intent))
              }
            />
          ) : null}
          <ImageSearchRecovery
            error={search.error}
            fallbackText={search.fallbackText}
            onRetry={search.clear}
            onManual={(text) => {
              if (!text) return window.location.assign("/jobs");
              const parameters = new URLSearchParams({ q: text.slice(0, 200) });
              window.location.assign(`/jobs?${parameters.toString()}`);
            }}
          />
        </div>
      </details>
    </aside>
  );
}
