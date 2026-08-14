"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";

export type JobSearchCriteria = Partial<
  Record<string, string | string[] | number | undefined>
>;

export type JobFilterTrigger = "debounced" | "immediate";

type ActiveFilter = Readonly<{
  id: string;
  label: string;
  name: string;
  value?: string;
  href: string;
}>;

type JobSearchFormProps = Readonly<{
  criteria: JobSearchCriteria;
  onCriteriaChange?: (
    criteria: JobSearchCriteria,
    trigger: JobFilterTrigger,
  ) => void;
  onClear?: () => void;
  resultCount?: number;
  isLoading?: boolean;
}>;

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
  RELEVANCE: "Relevance",
  NEWEST: "Newest",
  SALARY_DESC: "Highest salary",
  "1": "24 hours",
  "3": "3 days",
  "7": "7 days",
  "14": "14 days",
  "30": "30 days",
};

const valueLabelsVi: Record<string, string> = {
  FULL_TIME: "Toàn thời gian",
  PART_TIME: "Bán thời gian",
  CONTRACT: "Hợp đồng",
  INTERNSHIP: "Thực tập",
  TEMPORARY: "Tạm thời",
  ENTRY: "Mới bắt đầu",
  JUNIOR: "Junior",
  MID: "Trung cấp",
  SENIOR: "Cao cấp",
  LEAD: "Trưởng nhóm",
  MANAGER: "Quản lý",
  ONSITE: "Tại văn phòng",
  HYBRID: "Linh hoạt",
  REMOTE: "Từ xa",
  RELEVANCE: "Liên quan nhất",
  NEWEST: "Mới nhất",
  SALARY_DESC: "Lương cao nhất",
  "1": "24 giờ",
  "3": "3 ngày",
  "7": "7 ngày",
  "14": "14 ngày",
  "30": "30 ngày",
};

const one = (value: JobSearchCriteria[string]) =>
  Array.isArray(value) ? (value[0] ?? "") : (value?.toString() ?? "");

export function jobCriteriaParams(criteria: JobSearchCriteria) {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(criteria)) {
    if (
      value === undefined ||
      name === "cursor" ||
      name === "limit" ||
      name === "page"
    )
      continue;
    for (const item of Array.isArray(value) ? value : [String(value)]) {
      if (item) params.append(name, item);
    }
  }
  return params;
}

function removeFilterHref(
  criteria: JobSearchCriteria,
  name: string,
  value?: string,
) {
  const params = jobCriteriaParams(criteria);
  const existing = params.getAll(name);
  params.delete(name);
  if (value !== undefined) {
    for (const item of existing.filter((item) => item !== value))
      params.append(name, item);
  }
  const query = params.toString();
  return query ? `/jobs?${query}` : "/jobs";
}

function removeCriterion(
  criteria: JobSearchCriteria,
  name: string,
  value?: string,
): JobSearchCriteria {
  const next = { ...criteria };
  const current = next[name];
  if (Array.isArray(current) && value !== undefined) {
    const remaining = current.filter((item) => item !== value);
    if (remaining.length) next[name] = remaining;
    else delete next[name];
  } else {
    delete next[name];
  }
  return next;
}

function activeFilters(
  criteria: JobSearchCriteria,
  locale: "vi" | "en",
): ActiveFilter[] {
  const labels =
    locale === "vi"
      ? {
          q: "Từ khóa",
          location: "Địa điểm",
          employmentType: "Loại việc",
          experienceLevel: "Cấp độ",
          workArrangement: "Hình thức",
          careerPath: "Lộ trình",
          skills: "Kỹ năng",
          salaryMin: "Lương từ",
          salaryMax: "Lương đến",
          postedWithinDays: "Đăng trong",
          sort: "Sắp xếp",
        }
      : {
          q: "Keyword",
          location: "Location",
          employmentType: "Employment type",
          experienceLevel: "Experience level",
          workArrangement: "Work arrangement",
          careerPath: "Career path",
          skills: "Skill",
          salaryMin: "Salary from",
          salaryMax: "Salary to",
          postedWithinDays: "Posted within",
          sort: "Sort",
        };
  const enums = locale === "vi" ? valueLabelsVi : valueLabels;
  const output: ActiveFilter[] = [];
  const add = (name: keyof typeof labels, raw: string, value = raw) => {
    if (!raw || (name === "sort" && raw === "RELEVANCE")) return;
    const salary = name === "salaryMin" || name === "salaryMax";
    const visible = salary
      ? `${new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US").format(Number(raw))} VND`
      : (enums[raw] ?? raw);
    output.push({
      id: `${name}:${value}`,
      label: `${labels[name]}: ${visible}`,
      name,
      value,
      href: removeFilterHref(criteria, name, value),
    });
  };

  for (const name of [
    "q",
    "location",
    "employmentType",
    "experienceLevel",
    "workArrangement",
    "careerPath",
    "skills",
    "salaryMin",
    "salaryMax",
    "postedWithinDays",
    "sort",
  ] as const) {
    const value = criteria[name];
    for (const item of Array.isArray(value)
      ? value
      : value === undefined
        ? []
        : [String(value)])
      add(name, item, item);
  }
  return output;
}

export function JobSearchForm({
  criteria,
  onCriteriaChange,
  onClear,
  resultCount,
  isLoading = false,
}: JobSearchFormProps) {
  const locale = useWorkspaceLocale();
  const vi = locale === "vi";
  const copy = vi
    ? {
        mobile: "Bộ lọc",
        close: "Đóng bộ lọc",
        applied: "Bộ lọc đang áp dụng",
        clear: "Xoá bộ lọc",
        remove: "Xoá bộ lọc",
        refine: "Tinh chỉnh tìm kiếm",
        filters: "Bộ lọc",
        intro: "Danh sách tự cập nhật khi bạn thay đổi tiêu chí.",
        keywords: "Từ khóa",
        keywordPlaceholder: "Chức danh, kỹ năng hoặc công ty",
        location: "Địa điểm",
        employment: "Loại công việc",
        experience: "Cấp độ kinh nghiệm",
        arrangement: "Hình thức làm việc",
        salaryMin: "Lương tối thiểu (VND/tháng)",
        salaryMax: "Lương tối đa (VND/tháng)",
        skill: "Kỹ năng",
        posted: "Thời gian đăng",
        sort: "Sắp xếp",
        any: "Tất cả",
        anyTime: "Mọi thời điểm",
        image: "Tìm bằng hình ảnh",
        updating: "Đang cập nhật",
        matching: "việc làm phù hợp",
        noMatching: "Chưa có việc làm phù hợp",
      }
    : {
        mobile: "Filters",
        close: "Close filters",
        applied: "Applied filters",
        clear: "Clear filters",
        remove: "Remove filter",
        refine: "Refine search",
        filters: "Filters",
        intro: "The list updates as you change a criterion.",
        keywords: "Keywords",
        keywordPlaceholder: "Title, skill, or company",
        location: "Location",
        employment: "Employment type",
        experience: "Experience level",
        arrangement: "Work arrangement",
        salaryMin: "Minimum salary (VND/month)",
        salaryMax: "Maximum salary (VND/month)",
        skill: "Skill",
        posted: "Posted within",
        sort: "Sort",
        any: "Any",
        anyTime: "Any time",
        image: "Search from an image",
        updating: "Updating",
        matching: "matching jobs",
        noMatching: "No matching jobs yet",
      };
  const filters = useMemo(
    () => activeFilters(criteria, locale),
    [criteria, locale],
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawer = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const live = Boolean(onCriteriaChange);
  const optionLabel = (value: string) =>
    (vi ? valueLabelsVi : valueLabels)[value] ?? value;

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    const returnTarget = trigger.current;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => drawer.current?.focus(), 0);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab" || !drawer.current) return;
      const controls = Array.from(
        drawer.current.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex='-1'])",
        ),
      );
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = previousOverflow;
      returnTarget?.focus();
    };
  }, [mobileOpen]);

  useEffect(() => {
    const filterColumn =
      form.current?.closest<HTMLElement>(".job-filter-column");
    if (!filterColumn) return;

    const scrollFilterColumn = (event: WheelEvent) => {
      const maximumScrollTop =
        filterColumn.scrollHeight - filterColumn.clientHeight;
      if (!event.deltaY || maximumScrollTop <= 0) return;

      const nextScrollTop = Math.max(
        0,
        Math.min(maximumScrollTop, filterColumn.scrollTop + event.deltaY),
      );
      if (nextScrollTop === filterColumn.scrollTop) return;

      event.preventDefault();
      filterColumn.scrollTop = nextScrollTop;
    };

    filterColumn.addEventListener("wheel", scrollFilterColumn, {
      passive: false,
    });
    return () => filterColumn.removeEventListener("wheel", scrollFilterColumn);
  }, []);

  const valueProps = (name: string) =>
    live
      ? { value: one(criteria[name]) }
      : { defaultValue: one(criteria[name]) };

  const updateCriterion = (
    name: string,
    value: string,
    trigger: JobFilterTrigger,
  ) => {
    if (!onCriteriaChange) return;
    const next = { ...criteria };
    if (value) next[name] = value;
    else delete next[name];
    onCriteriaChange(next, trigger);
  };

  const countText =
    resultCount === undefined
      ? ""
      : resultCount
        ? `${new Intl.NumberFormat(vi ? "vi-VN" : "en-US").format(resultCount)} ${copy.matching}`
        : copy.noMatching;

  return (
    <div className="job-filter-shell" data-mobile-open={mobileOpen}>
      <button
        ref={trigger}
        className="job-filter-mobile-trigger"
        type="button"
        aria-expanded={mobileOpen}
        aria-controls="job-filter-drawer"
        onClick={() => setMobileOpen(true)}
      >
        <span>{copy.mobile}</span>
        <strong>{filters.length}</strong>
      </button>

      {filters.length ? (
        <div className="job-active-filters" aria-label={copy.applied}>
          <div>
            {filters.map((filter) =>
              onCriteriaChange ? (
                <button
                  key={filter.id}
                  className="job-active-filter-chip"
                  type="button"
                  onClick={() =>
                    onCriteriaChange(
                      removeCriterion(criteria, filter.name, filter.value),
                      "immediate",
                    )
                  }
                >
                  {filter.label}
                  <span aria-hidden="true">×</span>
                  <span className="sr-only">
                    {copy.remove} {filter.label}
                  </span>
                </button>
              ) : (
                <Link key={filter.id} href={filter.href}>
                  {filter.label}
                  <span aria-hidden="true">×</span>
                  <span className="sr-only">
                    {copy.remove} {filter.label}
                  </span>
                </Link>
              ),
            )}
          </div>
          {!onClear ? (
            <Link className="job-active-filters-clear" href="/jobs">
              {copy.clear}
            </Link>
          ) : null}
        </div>
      ) : null}

      {mobileOpen ? (
        <button
          className="job-filter-mobile-backdrop"
          type="button"
          aria-label={copy.close}
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <section
        ref={drawer}
        id="job-filter-drawer"
        className="job-filter-drawer"
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen ? true : undefined}
        aria-label={mobileOpen ? copy.filters : undefined}
        tabIndex={mobileOpen ? -1 : undefined}
      >
        <form
          ref={form}
          className="job-panel job-filter-form"
          role="search"
          aria-label={vi ? "Tìm kiếm việc làm" : "Job search"}
          action="/jobs"
          onSubmit={(event) => {
            event.preventDefault();
            onCriteriaChange?.(criteria, "immediate");
          }}
        >
          <header className="job-filter-heading">
            <span className="job-filter-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 6h16M7 12h10M10 18h4" />
              </svg>
            </span>
            <div>
              <p className="panel-kicker">{copy.refine}</p>
              <div className="job-filter-title-row">
                <h2>{copy.filters}</h2>
                <p
                  className="job-filter-result-count"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {countText
                    ? isLoading
                      ? `${countText} · ${copy.updating}`
                      : countText
                    : null}
                </p>
              </div>
            </div>
            <button
              className="job-filter-mobile-close"
              type="button"
              aria-label={copy.close}
              onClick={() => setMobileOpen(false)}
            >
              ×
            </button>
          </header>
          <p className="job-filter-copy">{copy.intro}</p>
          <div className="job-filter-fields">
            <label>
              {copy.keywords}
              <input
                name="q"
                type="search"
                maxLength={200}
                placeholder={copy.keywordPlaceholder}
                {...valueProps("q")}
                onChange={(event) =>
                  updateCriterion("q", event.currentTarget.value, "debounced")
                }
              />
            </label>
            <label>
              {copy.location}
              <input
                name="location"
                maxLength={160}
                placeholder="Ho Chi Minh City"
                {...valueProps("location")}
                onChange={(event) =>
                  updateCriterion(
                    "location",
                    event.currentTarget.value,
                    "debounced",
                  )
                }
              />
            </label>
            <label>
              {copy.employment}
              <select
                name="employmentType"
                {...valueProps("employmentType")}
                onChange={(event) =>
                  updateCriterion(
                    "employmentType",
                    event.currentTarget.value,
                    "immediate",
                  )
                }
              >
                <option value="">{copy.any}</option>
                <option value="FULL_TIME">{optionLabel("FULL_TIME")}</option>
                <option value="PART_TIME">{optionLabel("PART_TIME")}</option>
                <option value="CONTRACT">{optionLabel("CONTRACT")}</option>
                <option value="INTERNSHIP">{optionLabel("INTERNSHIP")}</option>
                <option value="TEMPORARY">{optionLabel("TEMPORARY")}</option>
              </select>
            </label>
            <label>
              {copy.experience}
              <select
                name="experienceLevel"
                {...valueProps("experienceLevel")}
                onChange={(event) =>
                  updateCriterion(
                    "experienceLevel",
                    event.currentTarget.value,
                    "immediate",
                  )
                }
              >
                <option value="">{copy.any}</option>
                <option value="ENTRY">{optionLabel("ENTRY")}</option>
                <option value="JUNIOR">Junior</option>
                <option value="MID">{optionLabel("MID")}</option>
                <option value="SENIOR">{optionLabel("SENIOR")}</option>
                <option value="LEAD">{optionLabel("LEAD")}</option>
                <option value="MANAGER">{optionLabel("MANAGER")}</option>
              </select>
            </label>
            <label>
              {copy.arrangement}
              <select
                name="workArrangement"
                {...valueProps("workArrangement")}
                onChange={(event) =>
                  updateCriterion(
                    "workArrangement",
                    event.currentTarget.value,
                    "immediate",
                  )
                }
              >
                <option value="">{copy.any}</option>
                <option value="ONSITE">{optionLabel("ONSITE")}</option>
                <option value="HYBRID">{optionLabel("HYBRID")}</option>
                <option value="REMOTE">{optionLabel("REMOTE")}</option>
              </select>
            </label>
            <label>
              {copy.salaryMin}
              <input
                name="salaryMin"
                type="number"
                min="0"
                inputMode="numeric"
                {...valueProps("salaryMin")}
                onChange={(event) =>
                  updateCriterion(
                    "salaryMin",
                    event.currentTarget.value,
                    "debounced",
                  )
                }
              />
            </label>
            <label>
              {copy.salaryMax}
              <input
                name="salaryMax"
                type="number"
                min="0"
                inputMode="numeric"
                {...valueProps("salaryMax")}
                onChange={(event) =>
                  updateCriterion(
                    "salaryMax",
                    event.currentTarget.value,
                    "debounced",
                  )
                }
              />
            </label>
            <label>
              {copy.skill}
              <input
                name="skills"
                maxLength={80}
                placeholder="TypeScript"
                {...valueProps("skills")}
                onChange={(event) =>
                  updateCriterion(
                    "skills",
                    event.currentTarget.value,
                    "debounced",
                  )
                }
              />
            </label>
            <label>
              {copy.posted}
              <select
                name="postedWithinDays"
                {...valueProps("postedWithinDays")}
                onChange={(event) =>
                  updateCriterion(
                    "postedWithinDays",
                    event.currentTarget.value,
                    "immediate",
                  )
                }
              >
                <option value="">{copy.anyTime}</option>
                <option value="1">{optionLabel("1")}</option>
                <option value="3">{optionLabel("3")}</option>
                <option value="7">{optionLabel("7")}</option>
                <option value="14">{optionLabel("14")}</option>
                <option value="30">{optionLabel("30")}</option>
              </select>
            </label>
            <label>
              {copy.sort}
              <select
                name="sort"
                value={live ? one(criteria.sort) || "RELEVANCE" : undefined}
                defaultValue={
                  live ? undefined : one(criteria.sort) || "RELEVANCE"
                }
                onChange={(event) =>
                  updateCriterion(
                    "sort",
                    event.currentTarget.value,
                    "immediate",
                  )
                }
              >
                <option value="RELEVANCE">{optionLabel("RELEVANCE")}</option>
                <option value="NEWEST">{optionLabel("NEWEST")}</option>
                <option value="SALARY_DESC">
                  {optionLabel("SALARY_DESC")}
                </option>
              </select>
            </label>
          </div>
          <div className="job-filter-actions">
            {onClear ? (
              <button
                className="job-secondary-link job-filter-clear"
                type="button"
                onClick={onClear}
              >
                <svg
                  className="job-filter-action-icon"
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                >
                  <path d="M20 11a8 8 0 1 0 1.6 4.8" />
                  <path d="M20 4v7h-7" />
                </svg>
                {copy.clear}
              </button>
            ) : (
              <Link
                className="job-secondary-link job-filter-clear"
                href="/jobs"
              >
                {copy.clear}
              </Link>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
