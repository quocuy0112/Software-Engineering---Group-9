import { PageHeader } from "@/frontend/components/layout/page-header";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { recruiterWorkspaceCopy } from "@/frontend/features/recruiter-workspace/recruiter-workspace-copy";

export default async function LoadingJobPostings() {
  const context = await getWorkspaceContext();
  const copy = recruiterWorkspaceCopy(context?.initialLocale ?? "en");
  return (
    <div
      className="recruiter-management"
      role="status"
      aria-busy="true"
      aria-label={copy.route.loadingJobPostings}
    >
      <PageHeader
        className="recruiter-management__page-header"
        eyebrow={copy.messages.recruiterWorkspace}
        title={copy.route.jobPostings}
        subtitle={copy.route.loadingJobPostingsDescription}
      />
      <div className="recruiter-job-list recruiter-job-list--skeleton">
        {[1, 2, 3].map((item) => (
          <div className="recruiter-skeleton-card" key={item}>
            <span />
            <span />
            <span />
            <span />
          </div>
        ))}
      </div>
    </div>
  );
}
