"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { JobSearchResponse } from "@/shared/contracts/jobs/discovery";
import { useOptionalJobInteraction } from "./job-interaction-provider";

export type JobSortMode =
  | "best-match"
  | "recently-posted"
  | "recently-updated"
  | "urgent"
  | "salary-high"
  | "salary-low";

const sortByServerValue: Record<JobSortMode, string> = {
  "best-match": "RELEVANCE",
  "recently-posted": "NEWEST",
  "recently-updated": "NEWEST",
  urgent: "RELEVANCE",
  "salary-high": "SALARY_DESC",
  "salary-low": "RELEVANCE",
};

const sortModeFromServerValue: Record<string, JobSortMode> = {
  RELEVANCE: "best-match",
  NEWEST: "recently-posted",
  SALARY_DESC: "salary-high",
};

const filterLabels: Record<string, string> = {
  q: "Keyword",
  location: "Location",
  employmentType: "Work type",
  experienceLevel: "Level",
  workArrangement: "Arrangement",
  skills: "Skill",
  salaryMin: "Minimum salary",
  salaryMax: "Maximum salary",
  postedWithinDays: "Posted within",
  experienceMinYears: "Experience",
  categoryFamily: "Category",
  workOnSaturday: "Saturday work",
};

const valueLabels: Record<string, string> = {
  FULL_TIME: "Full time",
  PART_TIME: "Part time",
  CONTRACT: "Contract",
  INTERNSHIP: "Internship",
  TEMPORARY: "Temporary",
  ENTRY: "Entry",
  JUNIOR: "Junior",
  MID: "Mid-level",
  SENIOR: "Senior",
  LEAD: "Lead",
  MANAGER: "Manager",
  ONSITE: "On-site",
  HYBRID: "Hybrid",
  REMOTE: "Remote",
  "1": "24 hours",
  "3": "3 days",
  "7": "7 days",
  "14": "14 days",
  "30": "30 days",
};

const quickFilters = [
  { label: "Remote", name: "workArrangement", value: "REMOTE" },
  { label: "Hybrid", name: "workArrangement", value: "HYBRID" },
  { label: "Full time", name: "employmentType", value: "FULL_TIME" },
  { label: "New this week", name: "postedWithinDays", value: "7" },
  { label: "20M+ VND", name: "salaryMin", value: "20000000" },
] as const;

export function sortModeFromParams(params: URLSearchParams) {
  const explicit = params.get("sortBy") as JobSortMode | null;
  if (
    explicit &&
    Object.prototype.hasOwnProperty.call(sortByServerValue, explicit)
  )
    return explicit;
  return (
    sortModeFromServerValue[params.get("sort") ?? "RELEVANCE"] ?? "best-match"
  );
}

function useFilterNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const navigate = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      params.delete("cursor");
      const query = params.toString();
      startTransition(() => {
        router.replace(query ? pathname + "?" + query : pathname, {
          scroll: false,
        });
      });
    },
    [pathname, router, searchParams],
  );

  return { navigate, searchParams, isPending };
}

function toggleQueryValue(
  params: URLSearchParams,
  name: string,
  value: string,
) {
  const values = params.getAll(name);
  params.delete(name);
  if (!values.includes(value)) {
    for (const item of [...values, value]) params.append(name, item);
  } else {
    for (const item of values.filter((item) => item !== value))
      params.append(name, item);
  }
}

export function SortDropdown({
  value,
  onChange,
}: {
  value: JobSortMode;
  onChange: (value: JobSortMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected =
    sortOptions.find((option) => option.value === value) ?? sortOptions[0];

  return (
    <div className="job-sort-dropdown">
      <span className="job-sort-label">Sort by</span>
      <button
        className="job-sort-trigger"
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="job-sort-trigger-icon" aria-hidden="true">
          {selected.icon}
        </span>
        <span>
          <strong>{selected.label}</strong>
          <small>{selected.description}</small>
        </span>
        <span className="job-sort-chevron" aria-hidden="true">
          {open ? "⌃" : "⌄"}
        </span>
      </button>
      {open ? (
        <div className="job-sort-menu" role="listbox" aria-label="Sort jobs">
          {sortOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                setOpen(false);
                onChange(option.value);
              }}
            >
              <span className="job-sort-option-icon" aria-hidden="true">
                {option.icon}
              </span>
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
              {option.value === value ? (
                <span className="job-sort-check" aria-hidden="true">
                  ✓
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const sortOptions: Array<{
  value: JobSortMode;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    value: "best-match",
    label: "Best match",
    description: "Aligned to your profile",
    icon: "✦",
  },
  {
    value: "recently-posted",
    label: "Recently posted",
    description: "Freshest opportunities first",
    icon: "◷",
  },
  {
    value: "recently-updated",
    label: "Recently updated",
    description: "Roles with new details",
    icon: "↻",
  },
  {
    value: "urgent",
    label: "Urgent hiring",
    description: "Closing soon and hiring now",
    icon: "♨",
  },
  {
    value: "salary-high",
    label: "Salary: high to low",
    description: "Highest published range first",
    icon: "↗",
  },
  {
    value: "salary-low",
    label: "Salary: low to high",
    description: "Lowest published range first",
    icon: "↘",
  },
];

export function AdvancedFilters({
  onUpdate,
}: {
  onUpdate: (
    mutate: (params: URLSearchParams) => void,
    immediate?: boolean,
  ) => void;
}) {
  const params = useSearchParams();
  const [location, setLocation] = useState(params.get("location") ?? "");
  const [skill, setSkill] = useState(params.get("skills") ?? "");
  const locationTimer = useRef<number | null>(null);
  const skillTimer = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLocation(params.get("location") ?? "");
      setSkill(params.get("skills") ?? "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [params]);

  function scheduleText(
    name: string,
    value: string,
    timer: MutableRefObject<number | null>,
    setValue: (value: string) => void,
  ) {
    setValue(value);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      onUpdate((next) => {
        if (value.trim()) next.set(name, value.trim());
        else next.delete(name);
      });
    }, 400);
  }

  return (
    <div className="job-advanced-filter-groups">
      <details open>
        <summary>
          <span>Salary</span>
          <span aria-hidden="true">⌄</span>
        </summary>
        <div className="job-filter-group-content">
          <div className="job-salary-presets" aria-label="Salary presets">
            {[10000000, 20000000, 40000000].map((value) => (
              <button
                key={value}
                className={
                  Number(params.get("salaryMin")) === value ? "is-active" : ""
                }
                type="button"
                onClick={() =>
                  onUpdate((next) => {
                    if (Number(next.get("salaryMin")) === value)
                      next.delete("salaryMin");
                    else next.set("salaryMin", String(value));
                  })
                }
              >
                {value / 1_000_000}M+
              </button>
            ))}
          </div>
          <div className="job-salary-sliders" aria-label="Salary range">
            <label>
              Minimum salary
              <input
                type="range"
                min="0"
                max="100000000"
                step="1000000"
                value={params.get("salaryMin") ?? "0"}
                onChange={(event) =>
                  onUpdate((next) => {
                    const minimum = Number(event.currentTarget.value);
                    const maximum = Number(
                      next.get("salaryMax") ?? "100000000",
                    );
                    next.set("salaryMin", String(Math.min(minimum, maximum)));
                  })
                }
              />
              <output>
                {Number(params.get("salaryMin") ?? 0) / 1_000_000}M+
              </output>
            </label>
            <label>
              Maximum salary
              <input
                type="range"
                min="0"
                max="100000000"
                step="1000000"
                value={params.get("salaryMax") ?? "100000000"}
                onChange={(event) =>
                  onUpdate((next) => {
                    const maximum = Number(event.currentTarget.value);
                    const minimum = Number(next.get("salaryMin") ?? "0");
                    next.set("salaryMax", String(Math.max(minimum, maximum)));
                  })
                }
              />
              <output>
                {Number(params.get("salaryMax") ?? 100_000_000) / 1_000_000}M
              </output>
            </label>
          </div>{" "}
          <div className="job-filter-two-column">
            <label>
              From
              <input
                className="sh-input"
                type="number"
                min="0"
                inputMode="numeric"
                value={params.get("salaryMin") ?? ""}
                onChange={(event) =>
                  onUpdate((next) => {
                    if (event.currentTarget.value)
                      next.set("salaryMin", event.currentTarget.value);
                    else next.delete("salaryMin");
                  })
                }
              />
            </label>
            <label>
              To
              <input
                className="sh-input"
                type="number"
                min="0"
                inputMode="numeric"
                value={params.get("salaryMax") ?? ""}
                onChange={(event) =>
                  onUpdate((next) => {
                    if (event.currentTarget.value)
                      next.set("salaryMax", event.currentTarget.value);
                    else next.delete("salaryMax");
                  })
                }
              />
            </label>
          </div>
          <p className="job-filter-help">Monthly VND ranges, before tax.</p>
        </div>
      </details>

      <details open>
        <summary>
          <span>Experience</span>
          <span aria-hidden="true">⌄</span>
        </summary>
        <div className="job-filter-group-content">
          <label>
            Minimum years
            <select
              className="sh-input"
              value={params.get("experienceMinYears") ?? ""}
              onChange={(event) =>
                onUpdate((next) => {
                  if (event.currentTarget.value)
                    next.set("experienceMinYears", event.currentTarget.value);
                  else next.delete("experienceMinYears");
                })
              }
            >
              <option value="">Any experience</option>
              <option value="1">1+ years</option>
              <option value="3">3+ years</option>
              <option value="5">5+ years</option>
              <option value="8">8+ years</option>
            </select>
          </label>
        </div>
      </details>

      <details open>
        <summary>
          <span>Job level</span>
          <span aria-hidden="true">⌄</span>
        </summary>
        <div className="job-filter-checks">
          {(
            ["ENTRY", "JUNIOR", "MID", "SENIOR", "LEAD", "MANAGER"] as const
          ).map((value) => (
            <label key={value}>
              <input
                type="checkbox"
                checked={params.getAll("experienceLevel").includes(value)}
                onChange={() =>
                  onUpdate((next) =>
                    toggleQueryValue(next, "experienceLevel", value),
                  )
                }
              />
              <span>{valueLabels[value]}</span>
            </label>
          ))}
        </div>
      </details>

      <details>
        <summary>
          <span>Work type</span>
          <span aria-hidden="true">⌄</span>
        </summary>
        <div className="job-filter-checks">
          {(
            [
              "FULL_TIME",
              "PART_TIME",
              "CONTRACT",
              "INTERNSHIP",
              "TEMPORARY",
            ] as const
          ).map((value) => (
            <label key={value}>
              <input
                type="checkbox"
                checked={params.getAll("employmentType").includes(value)}
                onChange={() =>
                  onUpdate((next) =>
                    toggleQueryValue(next, "employmentType", value),
                  )
                }
              />
              <span>{valueLabels[value]}</span>
            </label>
          ))}
          {(["ONSITE", "HYBRID", "REMOTE"] as const).map((value) => (
            <label key={value}>
              <input
                type="checkbox"
                checked={params.getAll("workArrangement").includes(value)}
                onChange={() =>
                  onUpdate((next) =>
                    toggleQueryValue(next, "workArrangement", value),
                  )
                }
              />
              <span>{valueLabels[value]}</span>
            </label>
          ))}
        </div>
      </details>

      <details>
        <summary>
          <span>More filters</span>
          <span aria-hidden="true">⌄</span>
        </summary>
        <div className="job-filter-group-content">
          <label>
            City
            <input
              className="sh-input"
              value={location}
              placeholder="Ho Chi Minh City"
              onChange={(event) =>
                scheduleText(
                  "location",
                  event.currentTarget.value,
                  locationTimer,
                  setLocation,
                )
              }
            />
          </label>
          <label>
            Skill
            <input
              className="sh-input"
              value={skill}
              placeholder="TypeScript"
              onChange={(event) =>
                scheduleText(
                  "skills",
                  event.currentTarget.value,
                  skillTimer,
                  setSkill,
                )
              }
            />
          </label>
          <label>
            Category family
            <input
              className="sh-input"
              value={params.get("categoryFamily") ?? ""}
              placeholder="e.g. r1080"
              onChange={(event) =>
                onUpdate((next) => {
                  if (event.currentTarget.value)
                    next.set("categoryFamily", event.currentTarget.value);
                  else next.delete("categoryFamily");
                })
              }
            />
          </label>
          <label className="job-filter-check-label">
            <input
              type="checkbox"
              checked={params.get("workOnSaturday") === "true"}
              onChange={(event) =>
                onUpdate((next) => {
                  if (event.currentTarget.checked)
                    next.set("workOnSaturday", "true");
                  else next.delete("workOnSaturday");
                })
              }
            />
            <span>Works Saturdays</span>
          </label>
          <label>
            Posted within
            <select
              className="sh-input"
              value={params.get("postedWithinDays") ?? ""}
              onChange={(event) =>
                onUpdate((next) => {
                  if (event.currentTarget.value)
                    next.set("postedWithinDays", event.currentTarget.value);
                  else next.delete("postedWithinDays");
                })
              }
            >
              <option value="">Any time</option>
              <option value="1">24 hours</option>
              <option value="3">3 days</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
            </select>
          </label>
        </div>
      </details>
    </div>
  );
}

export function ActiveFilterChips({
  onRemove,
}: {
  onRemove: (name: string, value?: string) => void;
}) {
  const params = useSearchParams();
  const chips = useMemo(() => {
    const result: Array<{ name: string; value: string; label: string }> = [];
    for (const [name, value] of params.entries()) {
      if (
        [
          "sort",
          "sortBy",
          "limit",
          "cursor",
          "salaryCurrency",
          "salaryPeriod",
        ].includes(name)
      )
        continue;
      if (name === "searchBy" && value === "BOTH") continue;
      const label = filterLabels[name] ?? name;
      result.push({
        name,
        value,
        label: label + ": " + (valueLabels[value] ?? value),
      });
    }
    return result;
  }, [params]);

  if (!chips.length) return null;

  return (
    <div className="job-active-filters" aria-label="Active filters">
      <span className="job-active-filters-label">Filtered by</span>
      {chips.map((chip) => (
        <button
          className="job-filter-chip"
          key={chip.name + "-" + chip.value}
          type="button"
          onClick={() => onRemove(chip.name, chip.value)}
        >
          {chip.label}
          <span aria-hidden="true">×</span>
        </button>
      ))}
    </div>
  );
}

export function FilterBar({
  result,
  children,
}: {
  result: JobSearchResponse | null;
  children: ReactNode;
}) {
  const { navigate, searchParams, isPending } = useFilterNavigation();
  const shared = useOptionalJobInteraction();
  const [keyword, setKeyword] = useState(searchParams.get("q") ?? "");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const keywordTimer = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setKeyword(searchParams.get("q") ?? ""),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  const update = useCallback(
    (mutate: (params: URLSearchParams) => void) => navigate(mutate),
    [navigate],
  );

  function scheduleKeyword(value: string) {
    setKeyword(value);
    if (keywordTimer.current) window.clearTimeout(keywordTimer.current);
    keywordTimer.current = window.setTimeout(() => {
      update((params) => {
        if (value.trim()) params.set("q", value.trim());
        else params.delete("q");
      });
    }, 420);
  }

  function removeChip(name: string, value?: string) {
    update((params) => {
      if (value === undefined || params.getAll(name).length <= 1) {
        params.delete(name);
        return;
      }
      const values = params.getAll(name).filter((item) => item !== value);
      params.delete(name);
      for (const item of values) params.append(name, item);
    });
  }

  function clearAll() {
    update((params) => {
      for (const key of [...params.keys()]) params.delete(key);
    });
  }

  function changeSort(value: JobSortMode) {
    update((params) => {
      params.set("sortBy", value);
      params.set("sort", sortByServerValue[value]);
    });
  }

  const filterSnapshot = useMemo(() => {
    const snapshot: Record<string, unknown> = {};
    for (const key of new Set(searchParams.keys())) {
      const values = searchParams.getAll(key);
      snapshot[key] = values.length > 1 ? values : (values[0] ?? "");
    }
    return snapshot;
  }, [searchParams]);

  return (
    <div className="job-discovery-flow" aria-busy={isPending}>
      {isPending ? (
        <div className="job-progress-line" aria-hidden="true" />
      ) : null}
      <div className="job-filter-topbar">
        <div className="job-search-by">
          <label htmlFor="job-search-by">Search by</label>
          <select
            id="job-search-by"
            className="job-search-by-select"
            value={searchParams.get("searchBy") ?? "BOTH"}
            onChange={(event) =>
              update((params) =>
                params.set("searchBy", event.currentTarget.value),
              )
            }
          >
            <option value="TITLE">Job title</option>
            <option value="COMPANY">Company</option>
            <option value="BOTH">Title + company</option>
          </select>
        </div>
        <label className="job-keyword-field">
          <span className="sr-only">Search jobs</span>
          <span className="job-search-icon" aria-hidden="true">
            ⌕
          </span>
          <input
            type="search"
            value={keyword}
            maxLength={200}
            placeholder="Search job titles, skills, companies"
            onChange={(event) => scheduleKeyword(event.currentTarget.value)}
          />
        </label>
        <div className="job-quick-filter-row" aria-label="Quick filters">
          {quickFilters.map((filter) => {
            const active = searchParams
              .getAll(filter.name)
              .includes(filter.value);
            return (
              <button
                className={
                  "job-quick-filter-pill" + (active ? " is-active" : "")
                }
                key={filter.name + filter.value}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  update((params) =>
                    toggleQueryValue(params, filter.name, filter.value),
                  )
                }
              >
                {filter.label}
                {active ? <span aria-hidden="true">✓</span> : null}
              </button>
            );
          })}
        </div>
        <SortDropdown
          value={sortModeFromParams(searchParams)}
          onChange={changeSort}
        />
        <div className="job-filter-mobile-actions">
          <button
            className="job-mobile-filter-button"
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
          >
            <span aria-hidden="true">☷</span>
            Filters &amp; Sort
          </button>
        </div>
        <p className="job-live-count" aria-live="polite">
          <strong>{result?.total ?? 0}</strong> matching jobs
        </p>
      </div>

      <ActiveFilterChips onRemove={removeChip} />
      <div className="job-discovery-grid">
        <aside
          className="job-advanced-sidebar"
          aria-label="Advanced job filters"
        >
          <div className="job-advanced-heading">
            <div>
              <p className="panel-kicker">REFINE THE SIGNAL</p>
              <h2>Advanced filters</h2>
            </div>
            <button type="button" onClick={clearAll}>
              Clear
            </button>
          </div>
          <AdvancedFilters onUpdate={update} />
          <div className="job-save-filter-card">
            <span className="job-save-filter-icon" aria-hidden="true">
              ◌
            </span>
            <div>
              <strong>Keep this search</strong>
              <p>Name this filter combo and reuse it later.</p>
            </div>
            <button type="button" onClick={() => setSaveDialogOpen(true)}>
              Save this search
            </button>
            {shared?.savedFilterPresets.length ? (
              <select
                aria-label="Saved searches"
                defaultValue=""
                onChange={(event) => {
                  const preset = shared.savedFilterPresets.find(
                    (item) => item.id === event.currentTarget.value,
                  );
                  if (!preset) return;
                  update((params) => {
                    for (const key of [...params.keys()]) params.delete(key);
                    for (const [key, value] of Object.entries(preset.filters)) {
                      if (Array.isArray(value)) {
                        for (const item of value)
                          if (typeof item === "string")
                            params.append(key, item);
                      } else if (typeof value === "string") {
                        params.set(key, value);
                      }
                    }
                  });
                  event.currentTarget.value = "";
                }}
              >
                <option value="">Reuse saved search…</option>
                {shared.savedFilterPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </aside>
        <section className="job-results-column">{children}</section>
      </div>

      {mobileFiltersOpen ? (
        <div
          className="job-bottom-sheet-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setMobileFiltersOpen(false);
          }}
        >
          <section
            className="job-bottom-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-filters-title"
          >
            <div className="job-bottom-sheet-handle" aria-hidden="true" />
            <header>
              <div>
                <p className="panel-kicker">PERSONALIZE THE LIST</p>
                <h2 id="mobile-filters-title">Filters &amp; Sort</h2>
              </div>
              <button
                className="job-icon-button"
                type="button"
                aria-label="Close filters and sort"
                onClick={() => setMobileFiltersOpen(false)}
              >
                ×
              </button>
            </header>
            <div className="job-bottom-sheet-content">
              <SortDropdown
                value={sortModeFromParams(searchParams)}
                onChange={changeSort}
              />
              <AdvancedFilters onUpdate={update} />
            </div>
            <footer>
              <button
                className="sh-button sh-button--secondary"
                type="button"
                onClick={clearAll}
              >
                Clear all
              </button>
              <button
                className="sh-button"
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
              >
                Show {result?.total ?? 0} jobs
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {saveDialogOpen ? (
        <div className="job-save-filter-dialog-backdrop">
          <section
            className="job-save-filter-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-filter-title"
          >
            <p className="panel-kicker">SAVE FILTER</p>
            <h2 id="save-filter-title">Name this search</h2>
            <p>
              Saved searches are separate from applying a filter; this list is
              already live.
            </p>
            <label>
              Search name
              <input
                className="sh-input"
                autoFocus
                maxLength={160}
                value={presetName}
                placeholder="e.g. Senior remote product roles"
                onChange={(event) => setPresetName(event.currentTarget.value)}
              />
            </label>
            <div className="job-dialog-actions">
              <button
                className="sh-button sh-button--secondary"
                type="button"
                onClick={() => setSaveDialogOpen(false)}
              >
                Cancel
              </button>
              <button
                className="sh-button"
                type="button"
                disabled={!presetName.trim()}
                onClick={() => {
                  shared?.saveFilterPreset(presetName, filterSnapshot);
                  setPresetName("");
                  setSaveDialogOpen(false);
                }}
              >
                Save filter
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
