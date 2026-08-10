import { headers } from "next/headers";
import Link from "next/link";
import { JobDiscoveryService } from "@/backend/services/jobs/job-discovery-service";
import { JobServiceError } from "@/backend/services/jobs/job-types";
import { optionalJobActor } from "@/backend/security/job-request-boundary";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { JobResultsList } from "@/frontend/features/jobs/components/job-results-list";
import { JobSearchForm } from "@/frontend/features/jobs/components/job-search-form";
import { JobsWorkspaceNav } from "@/frontend/features/jobs/components/jobs-workspace";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function query(input: Record<string, string | string[] | undefined>) {
  const array = (name: string) => {
    const value = input[name];
    return value === undefined ? [] : Array.isArray(value) ? value : [value];
  };
  return {
    q: Array.isArray(input.q) ? input.q[0] : input.q,
    location: Array.isArray(input.location)
      ? input.location[0]
      : input.location,
    employmentType: array("employmentType").filter(Boolean),
    experienceLevel: array("experienceLevel").filter(Boolean),
    workArrangement: array("workArrangement").filter(Boolean),
    skills: array("skills").filter(Boolean),
    salaryMin: Array.isArray(input.salaryMin)
      ? input.salaryMin[0]
      : input.salaryMin,
    salaryMax: Array.isArray(input.salaryMax)
      ? input.salaryMax[0]
      : input.salaryMax,
    salaryCurrency: Array.isArray(input.salaryCurrency)
      ? input.salaryCurrency[0]
      : input.salaryCurrency,
    salaryPeriod: Array.isArray(input.salaryPeriod)
      ? input.salaryPeriod[0]
      : input.salaryPeriod,
    postedWithinDays: Array.isArray(input.postedWithinDays)
      ? input.postedWithinDays[0]
      : input.postedWithinDays,
    sort: Array.isArray(input.sort) ? input.sort[0] : input.sort,
    cursor: Array.isArray(input.cursor) ? input.cursor[0] : input.cursor,
    limit: Array.isArray(input.limit) ? input.limit[0] : input.limit,
  };
}

export default async function JobsPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const workspace = await getWorkspaceContext();
  const vi = workspace?.initialLocale === "vi";
  const copy = vi
    ? {
        kicker: "Cơ hội từ Smart Hire",
        title: "Việc làm",
        intro:
          "Khám phá các cơ hội đã được xác minh và tìm công việc phù hợp với bước tiến tiếp theo của bạn.",
        jobs: "việc làm",
        openRoles: "vị trí đang tuyển",
        filters: "Bộ lọc việc làm",
        results: "Kết quả tìm kiếm",
        loadFailed: "Không thể tải việc làm",
        opportunities: "cơ hội",
        showing: "Đang hiển thị",
        of: "trên",
        reviewFilters: "Kiểm tra giá trị bộ lọc",
        tryAgain: "Không thể tải danh sách lúc này",
        clearRetry: "Xóa bộ lọc và thử lại",
        retry: "Thử tải lại",
        loadMore: "Xem thêm việc làm",
        empty: "Không có việc làm phù hợp",
        emptyCopy:
          "Hãy nới rộng địa điểm, mức lương hoặc thời gian đăng để xem thêm cơ hội.",
        clear: "Xóa tất cả bộ lọc",
        newest: "Xem việc mới nhất",
        remote: "Xem việc từ xa",
      }
    : {
        kicker: "Smart Hire opportunities",
        title: "Jobs",
        intro:
          "Discover verified opportunities and find work that fits your next career move.",
        jobs: "jobs",
        openRoles: "open roles",
        filters: "Job filters",
        results: "Search results",
        loadFailed: "Jobs could not be loaded",
        opportunities: "opportunities",
        showing: "Showing",
        of: "of",
        reviewFilters: "Review your filter values",
        tryAgain: "The job list is temporarily unavailable",
        clearRetry: "Clear filters and retry",
        retry: "Try loading again",
        loadMore: "Load more jobs",
        empty: "No jobs match these criteria",
        emptyCopy:
          "Try widening the location, salary, or posted-date range to see more opportunities.",
        clear: "Clear all filters",
        newest: "Browse newest jobs",
        remote: "Browse remote jobs",
      };
  const filterLabels: Record<string, string> = vi
    ? {
        q: "Từ khóa",
        location: "Địa điểm",
        employmentType: "Loại công việc",
        experienceLevel: "Cấp độ kinh nghiệm",
        workArrangement: "Hình thức làm việc",
        skills: "Kỹ năng",
        salaryMin: "Lương tối thiểu",
        salaryMax: "Lương tối đa",
        postedWithinDays: "Thời gian đăng",
        sort: "Sắp xếp",
      }
    : {
        q: "Keywords",
        location: "Location",
        employmentType: "Employment type",
        experienceLevel: "Experience level",
        workArrangement: "Work arrangement",
        skills: "Skill",
        salaryMin: "Minimum salary",
        salaryMax: "Maximum salary",
        postedWithinDays: "Posted within",
        sort: "Sort",
      };
  const actor = await optionalJobActor(await headers());
  let result;
  let error: string | null = null;
  let fieldErrors: Record<string, string[]> = {};
  try {
    result = await new JobDiscoveryService().search(query(raw), actor);
  } catch (caught) {
    if (caught instanceof JobServiceError) {
      error = caught.body.message;
      fieldErrors = caught.body.fieldErrors ?? {};
    } else {
      error = "Jobs could not be loaded. Try again in a moment.";
    }
  }
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    for (const item of Array.isArray(value) ? value : value ? [value] : [])
      next.append(key, item);
  }
  if (result?.nextCursor) next.set("cursor", result.nextCursor);
  return (
    <div className="jobs-page">
      <div className="jobs-fixed-region">
        <JobsWorkspaceNav activeTab="search" />
        <header className="page-heading jobs-heading">
          <div>
            <p className="workspace-kicker">{copy.kicker}</p>
            <h1 id="workspace-page-title">{copy.title}</h1>
            <p className="page-heading-copy">{copy.intro}</p>
          </div>
          {result ? (
            <span
              className="job-count-badge"
              aria-label={`${result.total} ${copy.jobs}`}
            >
              <strong>{result.total}</strong>
              <span>{copy.openRoles}</span>
            </span>
          ) : null}
        </header>
      </div>

      <div className="jobs-grid">
        <aside className="job-filter-column" aria-label={copy.filters}>
          <JobSearchForm criteria={raw} />
        </aside>

        <section className="job-results" aria-labelledby="job-results-heading">
          <header className="job-results-header">
            <div>
              <p className="panel-kicker">{copy.results}</p>
              <h2 id="job-results-heading">
                {error
                  ? copy.loadFailed
                  : `${result?.total ?? 0} ${copy.opportunities}`}
              </h2>
            </div>
            {!error && result ? (
              <p aria-live="polite">
                {copy.showing} {result.items.length} {copy.of} {result.total}
              </p>
            ) : null}
          </header>

          {error ? (
            <div className="job-panel job-feedback" role="alert">
              <h3>
                {Object.keys(fieldErrors).length
                  ? copy.reviewFilters
                  : copy.tryAgain}
              </h3>
              <p>{error}</p>
              {Object.keys(fieldErrors).length ? (
                <ul className="job-error-list">
                  {Object.entries(fieldErrors).flatMap(([field, messages]) =>
                    messages.map((message) => (
                      <li key={`${field}-${message}`}>
                        <strong>{filterLabels[field] ?? field}:</strong>{" "}
                        {message}
                      </li>
                    )),
                  )}
                </ul>
              ) : null}
              <Link
                className="job-secondary-link"
                href={
                  Object.keys(fieldErrors).length
                    ? "/jobs"
                    : `/jobs?${next.toString()}`
                }
              >
                {Object.keys(fieldErrors).length ? copy.clearRetry : copy.retry}
              </Link>
            </div>
          ) : result && result.items.length ? (
            <>
              <JobResultsList jobs={result.items} />
              {result.nextCursor ? (
                <div className="job-pagination">
                  <Link href={`/jobs?${next.toString()}`}>{copy.loadMore}</Link>
                </div>
              ) : null}
            </>
          ) : (
            <div className="job-panel job-empty-state">
              <span className="job-empty-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M4 7.5h16v11H4zM8 7.5V5.8A1.8 1.8 0 0 1 9.8 4h4.4A1.8 1.8 0 0 1 16 5.8v1.7M4 12h16" />
                </svg>
              </span>
              <h3>{copy.empty}</h3>
              <p>{copy.emptyCopy}</p>
              <div className="job-empty-actions">
                <Link className="job-secondary-link" href="/jobs">
                  {copy.clear}
                </Link>
                <Link className="job-secondary-link" href="/jobs?sort=NEWEST">
                  {copy.newest}
                </Link>
                <Link
                  className="job-secondary-link"
                  href="/jobs?workArrangement=REMOTE"
                >
                  {copy.remote}
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
