"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
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

export function jobTextSearchHref(href: string, query: string) {
  const parameters = new URL(href, "http://localhost").searchParams;
  parameters.delete("cursor");
  const value = query.trim();
  if (value) parameters.set("q", value.slice(0, 200));
  else parameters.delete("q");
  return parameters.size ? `/jobs?${parameters.toString()}` : "/jobs";
}

export function GlobalImageSearch({ csrfProof }: { csrfProof?: string } = {}) {
  const locale = useWorkspaceLocale();
  const vi = locale === "vi";
  const contextCsrfProof = useCsrfProof();
  const activeCsrfProof = csrfProof ?? contextCsrfProof;
  const criteria = useMemo(() => criteriaFromLocation(), []);
  const [externalConsent, setExternalConsent] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [query, setQuery] = useState(() => criteria.q);
  const cameraButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const search = useImageSearch({
    currentCriteria: criteria,
    csrfProof: activeCsrfProof,
  });
  const busy = search.phase === "UPLOADING" || search.phase === "PROCESSING";
  const showPanel = panelOpen || search.phase !== "IDLE";

  useEffect(() => {
    if (!showPanel) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || busy) return;
      event.preventDefault();
      setPanelOpen(false);
      setExternalConsent(false);
      search.clear();
      cameraButton.current?.focus();
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [busy, search, showPanel]);

  const closePanel = () => {
    setPanelOpen(false);
    setExternalConsent(false);
    search.clear();
    cameraButton.current?.focus();
  };

  return (
    <div
      id="global-image-search"
      className="global-image-search"
      data-phase={search.phase.toLowerCase()}
      aria-label={vi ? "Tìm kiếm việc làm toàn cục" : "Global job search"}
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
        aria-label={vi ? "Tìm kiếm việc làm toàn cục" : "Global job search"}
        onSubmit={(event) => {
          event.preventDefault();
          window.location.assign(
            jobTextSearchHref(window.location.href, query),
          );
        }}
      >
        <button
          ref={cameraButton}
          className="global-image-search-camera-button"
          type="button"
          aria-label={
            vi ? "Tìm việc bằng hình ảnh" : "Search jobs from an image"
          }
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
          {vi
            ? "Tìm công việc, kỹ năng hoặc công ty"
            : "Search jobs, skills, or companies"}
        </label>
        <input
          id="global-job-search-query"
          type="search"
          value={query}
          maxLength={200}
          placeholder={
            vi
              ? "Tìm công việc, kỹ năng hoặc công ty"
              : "Search jobs, skills, or companies"
          }
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
        <button
          className="global-image-search-submit"
          type="submit"
          aria-label={vi ? "Tìm việc" : "Search jobs"}
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
          ref={panel}
          id="global-image-search-panel"
          className="global-image-search-panel"
          role="dialog"
          aria-modal="false"
          aria-label={
            vi ? "Tìm việc bằng hình ảnh" : "Search jobs from an image"
          }
        >
          <div className="global-image-search-panel-heading">
            <div>
              <strong>
                {vi ? "Tìm việc bằng hình ảnh" : "Search jobs from an image"}
              </strong>
              <p>
                {vi
                  ? "Chuyển áp phích tuyển dụng thành các bộ lọc có thể chỉnh sửa."
                  : "Turn a job poster into editable search filters."}
              </p>
            </div>
            <button
              className="global-image-search-close"
              type="button"
              aria-label={vi ? "Đóng tìm kiếm hình ảnh" : "Close image search"}
              disabled={busy}
              onClick={closePanel}
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
              {vi
                ? "Đồng ý với thông báo xử lý văn bản trước khi chọn hình ảnh."
                : "Agree to the text-processing notice before choosing an image."}
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
    </div>
  );
}
