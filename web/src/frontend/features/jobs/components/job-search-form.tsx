"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";

type SearchCriteria = Partial<
  Record<string, string | string[] | number | undefined>
>;

type ActiveFilter = Readonly<{
  id: string;
  label: string;
  href: string;
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

const one = (value: SearchCriteria[string]) =>
  Array.isArray(value) ? (value[0] ?? "") : (value?.toString() ?? "");

function criteriaParams(criteria: SearchCriteria) {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(criteria)) {
    if (value === undefined || name === "cursor" || name === "limit") continue;
    for (const item of Array.isArray(value) ? value : [String(value)]) {
      if (item) params.append(name, item);
    }
  }
  return params;
}

function removeFilterHref(
  criteria: SearchCriteria,
  name: string,
  value?: string,
) {
  const params = criteriaParams(criteria);
  const existing = params.getAll(name);
  params.delete(name);
  if (value !== undefined) {
    for (const item of existing.filter((item) => item !== value))
      params.append(name, item);
  }
  const query = params.toString();
  return query ? `/jobs?${query}` : "/jobs";
}

function activeFilters(
  criteria: SearchCriteria,
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
      href: removeFilterHref(criteria, name, value),
    });
  };

  for (const name of [
    "q",
    "location",
    "employmentType",
    "experienceLevel",
    "workArrangement",
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

export function JobSearchForm({ criteria }: { criteria: SearchCriteria }) {
  const locale = useWorkspaceLocale();
  const vi = locale === "vi";
  const copy = vi
    ? {
        mobile: "Bộ lọc",
        close: "Đóng bộ lọc",
        applied: "Bộ lọc đang áp dụng",
        clear: "Xóa tất cả",
        refine: "Tinh chỉnh tìm kiếm",
        filters: "Bộ lọc",
        intro: "Thu hẹp danh sách bằng một hoặc nhiều tiêu chí.",
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
        search: "Tìm việc",
        image: "Tìm bằng hình ảnh",
      }
    : {
        mobile: "Filters",
        close: "Close filters",
        applied: "Applied filters",
        clear: "Clear all",
        refine: "Refine search",
        filters: "Filters",
        intro: "Narrow the list using one or more criteria.",
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
        search: "Search jobs",
        image: "Search from an image",
      };
  const filters = useMemo(
    () => activeFilters(criteria, locale),
    [criteria, locale],
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawer = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const form = useRef<HTMLFormElement>(null);

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
            {filters.map((filter) => (
              <Link key={filter.id} href={filter.href}>
                {filter.label}
                <span aria-hidden="true">×</span>
                <span className="sr-only">
                  {vi ? "Xóa bộ lọc" : "Remove filter"} {filter.label}
                </span>
              </Link>
            ))}
          </div>
          <Link className="job-active-filters-clear" href="/jobs">
            {vi ? "Đặt lại bộ lọc" : "Reset filters"}
          </Link>
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
        >
          <header className="job-filter-heading">
            <span className="job-filter-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 6h16M7 12h10M10 18h4" />
              </svg>
            </span>
            <div>
              <p className="panel-kicker">{copy.refine}</p>
              <h2>{copy.filters}</h2>
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
                defaultValue={one(criteria.q)}
                placeholder={copy.keywordPlaceholder}
              />
            </label>
            <label>
              {copy.location}
              <input
                name="location"
                maxLength={160}
                defaultValue={one(criteria.location)}
                placeholder="Ho Chi Minh City"
              />
            </label>
            <label>
              {copy.employment}
              <select
                name="employmentType"
                defaultValue={one(criteria.employmentType)}
              >
                <option value="">{copy.any}</option>
                <option value="FULL_TIME">
                  {vi ? "Toàn thời gian" : "Full time"}
                </option>
                <option value="PART_TIME">
                  {vi ? "Bán thời gian" : "Part time"}
                </option>
                <option value="CONTRACT">{vi ? "Hợp đồng" : "Contract"}</option>
                <option value="INTERNSHIP">
                  {vi ? "Thực tập" : "Internship"}
                </option>
                <option value="TEMPORARY">
                  {vi ? "Tạm thời" : "Temporary"}
                </option>
              </select>
            </label>
            <label>
              {copy.experience}
              <select
                name="experienceLevel"
                defaultValue={one(criteria.experienceLevel)}
              >
                <option value="">{copy.any}</option>
                <option value="ENTRY">{vi ? "Mới bắt đầu" : "Entry"}</option>
                <option value="JUNIOR">Junior</option>
                <option value="MID">{vi ? "Trung cấp" : "Mid-level"}</option>
                <option value="SENIOR">{vi ? "Cao cấp" : "Senior"}</option>
                <option value="LEAD">{vi ? "Trưởng nhóm" : "Lead"}</option>
                <option value="MANAGER">{vi ? "Quản lý" : "Manager"}</option>
              </select>
            </label>
            <label>
              {copy.arrangement}
              <select
                name="workArrangement"
                defaultValue={one(criteria.workArrangement)}
              >
                <option value="">{copy.any}</option>
                <option value="ONSITE">
                  {vi ? "Tại văn phòng" : "On-site"}
                </option>
                <option value="HYBRID">{vi ? "Linh hoạt" : "Hybrid"}</option>
                <option value="REMOTE">{vi ? "Từ xa" : "Remote"}</option>
              </select>
            </label>
            <label>
              {copy.salaryMin}
              <input
                name="salaryMin"
                type="number"
                min="0"
                defaultValue={one(criteria.salaryMin)}
              />
            </label>
            <label>
              {copy.salaryMax}
              <input
                name="salaryMax"
                type="number"
                min="0"
                defaultValue={one(criteria.salaryMax)}
              />
            </label>
            <label>
              {copy.skill}
              <input
                name="skills"
                maxLength={80}
                defaultValue={one(criteria.skills)}
                placeholder="TypeScript"
              />
            </label>
            <label>
              {copy.posted}
              <select
                name="postedWithinDays"
                defaultValue={one(criteria.postedWithinDays)}
              >
                <option value="">{copy.anyTime}</option>
                <option value="1">{vi ? "24 giờ" : "24 hours"}</option>
                <option value="3">{vi ? "3 ngày" : "3 days"}</option>
                <option value="7">{vi ? "7 ngày" : "7 days"}</option>
                <option value="14">{vi ? "14 ngày" : "14 days"}</option>
                <option value="30">{vi ? "30 ngày" : "30 days"}</option>
              </select>
            </label>
            <label>
              {copy.sort}
              <select
                name="sort"
                defaultValue={one(criteria.sort) || "RELEVANCE"}
              >
                <option value="RELEVANCE">
                  {vi ? "Liên quan nhất" : "Relevance"}
                </option>
                <option value="NEWEST">{vi ? "Mới nhất" : "Newest"}</option>
                <option value="SALARY_DESC">
                  {vi ? "Lương cao nhất" : "Highest salary"}
                </option>
              </select>
            </label>
          </div>
          <input type="hidden" name="salaryCurrency" value="VND" />
          <input type="hidden" name="salaryPeriod" value="MONTH" />
          <div className="job-filter-actions">
            <button className="job-primary-button" type="submit">
              {copy.search}
            </button>
            <Link className="job-secondary-link" href="/jobs">
              {copy.clear}
            </Link>
            <a className="job-secondary-link" href="#global-image-search">
              {copy.image}
            </a>
          </div>
        </form>
      </section>
    </div>
  );
}
