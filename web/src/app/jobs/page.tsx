import { headers } from "next/headers";
import { JobDiscoveryService } from "@/backend/services/jobs/job-discovery-service";
import { optionalJobActor } from "@/backend/security/job-request-boundary";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import {
  LiveJobSearchExperience,
  type JobsLiveCopy,
} from "@/frontend/features/jobs/components/live-job-search-experience";

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

const vietnameseCopy: JobsLiveCopy = {
  kicker: "Cơ hội từ Smart Hire",
  title: "Việc làm",
  intro:
    "Khám phá các cơ hội đã được xác minh và tìm công việc phù hợp với bước tiến tiếp theo của bạn.",
  jobs: "việc làm",
  openRoles: "vị trí đang tuyển",
  filters: "Bộ lọc việc làm",
  results: "Kết quả tìm kiếm",
  loadFailed: "Không thể tải việc làm",
  opportunities: "việc làm phù hợp",
  showing: "Đang hiển thị",
  of: "trên",
  tryAgain: "Danh sách việc làm tạm thời chưa thể tải. Vui lòng thử lại.",
  retry: "Thử lại",
  firstPage: "Trang đầu",
  previousPage: "Trang trước",
  nextPage: "Trang sau",
  lastPage: "Trang cuối",
  page: "Trang",
  empty: "Không tìm thấy việc làm phù hợp",
  emptyCopy: "Hãy nới lỏng một hoặc nhiều tiêu chí để xem thêm cơ hội.",
  clear: "Xoá bộ lọc",
};

const englishCopy: JobsLiveCopy = {
  kicker: "Smart Hire opportunities",
  title: "Jobs",
  intro:
    "Discover verified opportunities and find work that fits your next career move.",
  jobs: "jobs",
  openRoles: "open roles",
  filters: "Job filters",
  results: "Search results",
  loadFailed: "Jobs could not be loaded",
  opportunities: "matching jobs",
  showing: "Showing",
  of: "of",
  tryAgain: "The job list is temporarily unavailable. Please try again.",
  retry: "Try again",
  firstPage: "First page",
  previousPage: "Previous page",
  nextPage: "Next page",
  lastPage: "Last page",
  page: "Page",
  empty: "No jobs match these criteria",
  emptyCopy: "Try widening one or more criteria to see more opportunities.",
  clear: "Clear filters",
};

export default async function JobsPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const workspace = await getWorkspaceContext();
  const copy = workspace?.initialLocale === "vi" ? vietnameseCopy : englishCopy;
  const actor = await optionalJobActor(await headers());
  let result = null;
  let error: string | null = null;

  try {
    result = await new JobDiscoveryService().search(query(raw), actor);
  } catch {
    error = copy.tryAgain;
  }

  return (
    <div className="jobs-page">
      <LiveJobSearchExperience
        initialCriteria={raw}
        initialResult={result}
        initialError={error}
        copy={copy}
      />
    </div>
  );
}
