import { JobDiscoveryService } from "@/backend/services/jobs/job-discovery-service";
import {
  jobErrorResponse,
  optionalJobActor,
  publicJobJson,
} from "@/backend/security/job-request-boundary";

function query(request: Request) {
  const params = new URL(request.url).searchParams;
  const value = (name: string) => params.get(name) ?? undefined;
  return {
    q: value("q"),
    searchBy: value("searchBy"),
    location: value("location"),
    employmentType: params.getAll("employmentType"),
    experienceLevel: params.getAll("experienceLevel"),
    workArrangement: params.getAll("workArrangement"),
    skills: params.getAll("skills"),
    salaryMin: value("salaryMin"),
    salaryMax: value("salaryMax"),
    salaryCurrency: value("salaryCurrency"),
    salaryPeriod: value("salaryPeriod"),
    postedWithinDays: value("postedWithinDays"),
    sort: value("sort"),
    cursor: value("cursor"),
    page: value("page"),
    limit: value("limit"),
  };
}

export async function GET(request: Request) {
  try {
    const actor = await optionalJobActor(request.headers);
    const result = await new JobDiscoveryService().search(
      query(request),
      actor,
    );
    return publicJobJson(result, actor);
  } catch (error) {
    return jobErrorResponse(error);
  }
}
