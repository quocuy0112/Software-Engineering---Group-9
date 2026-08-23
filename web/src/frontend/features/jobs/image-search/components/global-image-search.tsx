"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import type { JobSearchTaxonomy } from "@/shared/contracts/jobs/taxonomy";
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

export function jobTextSearchHref(
  href: string,
  query: string,
  location?: string,
) {
  const parameters = new URL(href, "http://localhost").searchParams;
  parameters.delete("cursor");
  const value = query.trim();
  if (value) parameters.set("q", value.slice(0, 200));
  else parameters.delete("q");
  if (location !== undefined) {
    const locationValue = location.trim();
    if (locationValue) parameters.set("location", locationValue.slice(0, 160));
    else parameters.delete("location");
  }
  return parameters.size ? `/jobs?${parameters.toString()}` : "/jobs";
}

function JobCategoryMenu({
  taxonomy,
  onSelect,
  vi,
}: Readonly<{
  taxonomy: JobSearchTaxonomy;
  onSelect(title: string): void;
  vi: boolean;
}>) {
  const [open, setOpen] = useState(false);
  const [activeCode, setActiveCode] = useState(
    taxonomy.industries[0]?.code ?? "",
  );
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const categoryButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  const active =
    taxonomy.industries.find((industry) => industry.code === activeCode) ??
    taxonomy.industries[0];

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  const selectIndustry = (code: string) => {
    setActiveCode(code);
    setOpen(true);
  };

  const moveIndustryFocus = (code: string, direction: -1 | 1) => {
    const current = taxonomy.industries.findIndex(
      (industry) => industry.code === code,
    );
    const next =
      taxonomy.industries[
        (current + direction + taxonomy.industries.length) %
          taxonomy.industries.length
      ];
    if (!next) return;
    selectIndustry(next.code);
    categoryButtons.current[next.code]?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    const closeOutside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, [open]);

  if (!taxonomy.industries.length) return null;

  return (
    <div className="job-category-menu" ref={menu}>
      <button
        ref={trigger}
        className="job-category-trigger"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="job-category-flyout"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="job-category-trigger-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M5 7h14M5 12h14M5 17h14" />
          </svg>
        </span>
        <span>{vi ? "Job categories" : "Job Category"}</span>
        <svg
          className="job-category-trigger-chevron"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="m7 10 5 5 5-5" />
        </svg>
      </button>

      {open && active ? (
        <div
          id="job-category-flyout"
          className="job-category-flyout"
          role="dialog"
          aria-label={vi ? "Job categories" : "Job categories"}
        >
          <ul className="job-category-industries" aria-label="Job categories">
            {taxonomy.industries.map((industry) => {
              const selected = industry.code === active.code;
              return (
                <li className="job-category-industry-item" key={industry.code}>
                  <button
                    ref={(element) => {
                      categoryButtons.current[industry.code] = element;
                    }}
                    className="job-category-industry"
                    data-active={selected}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => selectIndustry(industry.code)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        moveIndustryFocus(industry.code, 1);
                      } else if (event.key === "ArrowUp") {
                        event.preventDefault();
                        moveIndustryFocus(industry.code, -1);
                      } else if (event.key === "Home") {
                        event.preventDefault();
                        const first = taxonomy.industries[0];
                        if (!first) return;
                        selectIndustry(first.code);
                        categoryButtons.current[first.code]?.focus();
                      } else if (event.key === "End") {
                        event.preventDefault();
                        const last = taxonomy.industries.at(-1);
                        if (!last) return;
                        selectIndustry(last.code);
                        categoryButtons.current[last.code]?.focus();
                      }
                    }}
                  >
                    <span
                      className="job-category-industry-marker"
                      aria-hidden="true"
                    >
                      <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="4" />
                      </svg>
                    </span>
                    <span className="job-category-industry-copy">
                      <strong>{industry.name}</strong>
                      <small>{industry.count} open roles</small>
                    </span>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="job-category-detail">
            <header className="job-category-detail-heading">
              <div>
                <p className="job-category-detail-title">{active.name}</p>
                <p className="job-category-open-roles">
                  Open roles ({active.count})
                </p>
              </div>
              <button
                className="job-category-close"
                type="button"
                aria-label="Close job categories"
                onClick={close}
              >
                <span aria-hidden="true">×</span>
              </button>
            </header>
            {active.subIndustries.map((subIndustry) => (
              <section
                className="job-category-subindustry"
                key={subIndustry.name}
              >
                <h2>
                  {subIndustry.name} <span>({subIndustry.count})</span>
                </h2>
                <div>
                  {subIndustry.titles.map((title) => (
                    <button
                      className="job-category-title-pill"
                      key={title.name}
                      type="button"
                      title={title.categoryIds.join(", ") || undefined}
                      onClick={() => onSelect(title.name)}
                    >
                      {title.name}
                      {title.count > 1 ? <small>{title.count}</small> : null}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BeforeAfterDemo({ vi }: { vi: boolean }) {
  return (
    <div className="image-search-demo" aria-hidden="true">
      <span className="image-search-demo-poster">POSTER</span>
      <span className="image-search-demo-arrow">→</span>
      <span className="image-search-demo-chips">
        <span>{vi ? "Vai trò" : "Role"}</span>
        <span>{vi ? "Địa điểm" : "Location"}</span>
        <span>{vi ? "Kinh nghiệm" : "Experience"}</span>
      </span>
    </div>
  );
}

export function GlobalImageSearch({
  csrfProof,
  taxonomy,
  dockToWorkspaceHeader = false,
}: {
  csrfProof?: string;
  taxonomy?: JobSearchTaxonomy;
  dockToWorkspaceHeader?: boolean;
} = {}) {
  const locale = useWorkspaceLocale();
  const vi = locale === "vi";
  const contextCsrfProof = useCsrfProof();
  const activeCsrfProof = csrfProof ?? contextCsrfProof;
  const criteria = useMemo(() => criteriaFromLocation(), []);
  const [externalConsent, setExternalConsent] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [query, setQuery] = useState(() => criteria.q);
  const [location, setLocation] = useState(() => criteria.location);
  const cameraButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const search = useImageSearch({
    currentCriteria: criteria,
    csrfProof: activeCsrfProof,
  });
  const busy = search.phase === "UPLOADING" || search.phase === "PROCESSING";
  const showPanel = panelOpen || search.phase !== "IDLE";
  const workspaceHeaderSlot =
    dockToWorkspaceHeader && typeof document !== "undefined"
      ? document.getElementById("workspace-job-search-slot")
      : null;

  useEffect(() => {
    if (!taxonomy || process.env.NODE_ENV !== "development") return;
    const expectedIndustryCount = 28;
    const message = `[job-taxonomy] client receipt: ${taxonomy.industries.length}/${expectedIndustryCount} industries`;
    if (taxonomy.industries.length === expectedIndustryCount)
      console.info(message);
    else console.warn(message);
  }, [taxonomy]);

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

  const searchControls = (
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
      <div className={taxonomy ? "job-search-row" : undefined}>
        <div className="job-search-discovery">
          {taxonomy ? (
            <JobCategoryMenu
              taxonomy={taxonomy}
              vi={vi}
              onSelect={(title) =>
                window.location.assign(
                  jobTextSearchHref(window.location.href, title, location),
                )
              }
            />
          ) : null}
          <form
            id="global-job-search-bar"
            className="global-image-search-bar"
            role="search"
            aria-label={vi ? "Tìm kiếm việc làm toàn cục" : "Global job search"}
            onSubmit={(event) => {
              event.preventDefault();
              window.location.assign(
                jobTextSearchHref(window.location.href, query, location),
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
            {taxonomy?.locations.length ? (
              <label className="global-image-search-location">
                <span className="sr-only">Location</span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" />
                  <circle cx="12" cy="10" r="2" />
                </svg>
                <select
                  value={location}
                  aria-label="Location"
                  onChange={(event) => setLocation(event.currentTarget.value)}
                >
                  <option value="">All locations</option>
                  {taxonomy.locations.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label} ({item.count})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {!taxonomy ? (
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
                <span className="global-image-search-submit-label">Search</span>
              </button>
            ) : null}
          </form>
        </div>
        {taxonomy ? (
          <button
            className="global-image-search-submit"
            type="submit"
            form="global-job-search-bar"
            aria-label={vi ? "Tìm việc" : "Search jobs"}
          >
            <span aria-hidden="true">
              <svg viewBox="0 0 20 20" role="img">
                <circle cx="8.5" cy="8.5" r="5.5" />
                <path d="m12.5 12.5 4 4" />
              </svg>
            </span>
            <span className="global-image-search-submit-label">Search</span>
          </button>
        ) : null}
      </div>
    </div>
  );

  return (
    <>
      {workspaceHeaderSlot
        ? createPortal(searchControls, workspaceHeaderSlot)
        : searchControls}
      {showPanel
        ? createPortal(
            <div
              className="global-image-search-overlay"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !busy) {
                  closePanel();
                }
              }}
            >
              <div
                ref={panel}
                id="global-image-search-panel"
                className="global-image-search-panel"
                role="dialog"
                aria-modal="true"
                aria-label={
                  vi ? "Tìm việc bằng hình ảnh" : "Search jobs from an image"
                }
              >
                <div className="global-image-search-panel-heading">
                  <div>
                    <strong>
                      {vi
                        ? "Tìm việc bằng hình ảnh"
                        : "Search jobs from an image"}
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
                    aria-label={
                      vi ? "Đóng tìm kiếm hình ảnh" : "Close image search"
                    }
                    disabled={busy}
                    onClick={closePanel}
                  >
                    <span aria-hidden="true">&#215;</span>
                  </button>
                </div>
                <BeforeAfterDemo vi={vi} />
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
                    void search
                      .start(file)
                      .finally(() => setExternalConsent(false));
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
                      window.location.assign(
                        applyImageSearchIntent(criteria, intent),
                      )
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
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
