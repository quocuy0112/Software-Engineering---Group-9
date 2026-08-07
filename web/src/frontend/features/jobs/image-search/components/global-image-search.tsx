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
import { ImageSearchFeedback } from "./image-search-feedback";

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
  const [panelOpen, setPanelOpen] = useState(false);
  const [query, setQuery] = useState("");
  const search = useImageSearch({
    currentCriteria: criteria,
    csrfProof,
  });
  const busy = search.phase === "UPLOADING" || search.phase === "PROCESSING";
  const showPanel = panelOpen || search.phase !== "IDLE";

  return (
    <header
      id="global-image-search"
      className="global-image-search"
      data-phase={search.phase.toLowerCase()}
      aria-label="Global job search"
    >
      <ImageSearchFeedback
        phase={search.phase}
        error={search.error}
        fallbackReason={search.fallbackReason}
        retryAt={search.retryAt}
        proposalCount={search.intent?.proposals.length ?? 0}
        warningCount={search.intent?.warnings.length ?? 0}
      />
      <form
        className="global-image-search-bar"
        role="search"
        aria-label="Global job search"
        onSubmit={(event) => {
          event.preventDefault();
          const value = query.trim();
          const parameters = new URLSearchParams();
          if (value) parameters.set("q", value.slice(0, 200));
          window.location.assign(
            parameters.size ? `/jobs?${parameters.toString()}` : "/jobs",
          );
        }}
      >
        <button
          className="global-image-search-camera-button"
          type="button"
          aria-label="Search jobs from an image"
          aria-controls="global-image-search-panel"
          aria-expanded={showPanel}
          onClick={() => setPanelOpen((open) => !open)}
        >
          <span aria-hidden="true">
            <svg viewBox="0 0 24 24" role="img">
              <path d="M8.5 7 10 4.8h4L15.5 7H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
              <circle cx="12" cy="13" r="3.2" />
            </svg>
          </span>
        </button>
        <label className="sr-only" htmlFor="global-job-search-query">
          Search jobs, skills, or companies
        </label>
        <input
          id="global-job-search-query"
          type="search"
          value={query}
          maxLength={200}
          placeholder="Search jobs, skills, or companies"
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
        <button
          className="global-image-search-submit"
          type="submit"
          aria-label="Search jobs"
        >
          <span aria-hidden="true">
            <svg viewBox="0 0 20 20" role="img">
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="m12.5 12.5 4 4" />
            </svg>
          </span>
        </button>
      </form>
      {showPanel ? (
        <div
          id="global-image-search-panel"
          className="global-image-search-panel"
        >
          <div className="global-image-search-panel-heading">
            <div>
              <strong>Search jobs from an image</strong>
              <p>Turn a job poster into editable search filters.</p>
            </div>
            <button
              className="global-image-search-close"
              type="button"
              aria-label="Close image search"
              disabled={busy}
              onClick={() => {
                setPanelOpen(false);
                setExternalConsent(false);
                search.clear();
              }}
            >
              <span aria-hidden="true">&#215;</span>
            </button>
          </div>
          <ImageSearchPrivacyNotice />
          <ImageSearchConsent
            selected={externalConsent}
            onChange={(selected) => {
              if (!selected && busy) void search.revokeConsent();
              setExternalConsent(selected);
            }}
          />
          <ImageSearchInput
            disabled={!externalConsent || busy}
            onSelect={(file) => {
              setPanelOpen(true);
              void search.start(file).finally(() => setExternalConsent(false));
            }}
          />
          {!externalConsent ? (
            <p className="image-search-consent-required" role="status">
              Agree to the OpenAI text-processing notice before choosing an
              image.
            </p>
          ) : null}
          {busy ? (
            <ImageSearchProgress
              progress={search.progress}
              onCancel={() => {
                setExternalConsent(false);
                void search.cancel();
              }}
            />
          ) : null}
          {search.intent ? (
            <ImageSearchProposals
              intent={search.intent}
              onClear={() => {
                setExternalConsent(false);
                search.clear();
              }}
              onApply={(intent) =>
                window.location.assign(applyImageSearchIntent(criteria, intent))
              }
            />
          ) : null}
          <ImageSearchRecovery
            error={search.error}
            fallbackReason={search.fallbackReason}
            retryAt={search.retryAt}
            onRetry={() => {
              setExternalConsent(false);
              search.clear();
            }}
            onManual={() => window.location.assign("/jobs")}
          />
        </div>
      ) : null}
    </header>
  );
}
