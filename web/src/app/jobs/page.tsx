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

function pageNumbers(currentPage: number, totalPages: number) {
  const first = Math.max(1, currentPage - 1);
  const last = Math.min(totalPages, currentPage + 1);
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

function pageHref(params: URLSearchParams, page: number) {
  const next = new URLSearchParams(params);
  next.delete("cursor");
  next.delete("page");
  if (page > 1) next.set("page", String(page));
  const search = next.toString();
  return search ? `/jobs?${search}` : "/jobs";
}

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
    careerPath: Array.isArray(input.careerPath)
      ? input.careerPath[0]
      : input.careerPath,
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
    page: Array.isArray(input.page) ? input.page[0] : input.page,
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
        firstPage: "Trang đầu",
        previousPage: "Trang trước",
        nextPage: "Trang sau",
        lastPage: "Trang cuối",
        page: "Trang",
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
        firstPage: "First page",
        previousPage: "Previous page",
        nextPage: "Next page",
        lastPage: "Last page",
        page: "Page",
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
  const paginationParams = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    for (const item of Array.isArray(value) ? value : value ? [value] : [])
      paginationParams.append(key, item);
  }
  return (
    <div className="jobs-page">
      <div className="jobs-fixed-region">
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
        <JobsWorkspaceNav activeTab="search" />
      </div>

      <div className="jobs-grid">
        <aside className="job-filter-column" aria-label={copy.filters}>
          <JobSearchForm criteria={raw} />
        </aside>

        <section className="job-results" aria-labelledby="job-results-heading">
          <header className="job-results-header">
            <p className="panel-kicker" id="job-results-heading">
              {error ? copy.loadFailed : copy.results}
            </p>
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
                    : pageHref(paginationParams, 1)
                }
              >
                {Object.keys(fieldErrors).length ? copy.clearRetry : copy.retry}
              </Link>
            </div>
          ) : result && result.items.length ? (
            <>
              <JobResultsList jobs={result.items} />
              {result.totalPages > 1 ? (
                <nav className="job-pagination" aria-label="Job result pages">
                  {result.page === 1 ? (
                    <span
                      className="job-pagination-control is-disabled"
                      aria-disabled="true"
                    >
                      <span aria-hidden="true">«</span>
                      <span className="job-pagination-control-label">
                        {copy.firstPage}
                      </span>
                    </span>
                  ) : (
                    <Link
                      className="job-pagination-control"
                      href={pageHref(paginationParams, 1)}
                      aria-label={copy.firstPage}
                    >
                      <span aria-hidden="true">«</span>
                      <span className="job-pagination-control-label">
                        {copy.firstPage}
                      </span>
                    </Link>
                  )}
                  {result.page === 1 ? (
                    <span
                      className="job-pagination-control is-disabled"
                      aria-disabled="true"
                    >
                      <span aria-hidden="true">‹</span>
                      <span className="job-pagination-control-label">
                        {copy.previousPage}
                      </span>
                    </span>
                  ) : (
                    <Link
                      className="job-pagination-control"
                      href={pageHref(paginationParams, result.page - 1)}
                      aria-label={copy.previousPage}
                    >
                      <span aria-hidden="true">‹</span>
                      <span className="job-pagination-control-label">
                        {copy.previousPage}
                      </span>
                    </Link>
                  )}
                  <div className="job-pagination-pages">
                    <ol>
                      {pageNumbers(result.page, result.totalPages).map(
                        (page) => (
                          <li key={page}>
                            {page === result.page ? (
                              <span
                                className="job-pagination-page is-current"
                                aria-current="page"
                                aria-label={`${copy.page} ${page}`}
                              >
                                {page}
                              </span>
                            ) : (
                              <Link
                                className="job-pagination-page"
                                href={pageHref(paginationParams, page)}
                                aria-label={`${copy.page} ${page}`}
                              >
                                {page}
                              </Link>
                            )}
                          </li>
                        ),
                      )}
                    </ol>
                  </div>
                  {result.page === result.totalPages ? (
                    <span
                      className="job-pagination-control is-disabled"
                      aria-disabled="true"
                    >
                      <span className="job-pagination-control-label">
                        {copy.nextPage}
                      </span>
                      <span aria-hidden="true">›</span>
                    </span>
                  ) : (
                    <Link
                      className="job-pagination-control"
                      href={pageHref(paginationParams, result.page + 1)}
                      aria-label={copy.nextPage}
                    >
                      <span className="job-pagination-control-label">
                        {copy.nextPage}
                      </span>
                      <span aria-hidden="true">›</span>
                    </Link>
                  )}
                  {result.page === result.totalPages ? (
                    <span
                      className="job-pagination-control is-disabled"
                      aria-disabled="true"
                    >
                      <span className="job-pagination-control-label">
                        {copy.lastPage}
                      </span>
                      <span aria-hidden="true">»</span>
                    </span>
                  ) : (
                    <Link
                      className="job-pagination-control"
                      href={pageHref(paginationParams, result.totalPages)}
                      aria-label={copy.lastPage}
                    >
                      <span className="job-pagination-control-label">
                        {copy.lastPage}
                      </span>
                      <span aria-hidden="true">»</span>
                    </Link>
                  )}
                  <p className="job-pagination-progress" aria-live="polite">
                    {copy.page} {result.page} / {result.totalPages}
                  </p>
                </nav>
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
