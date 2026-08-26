import { PageHeader } from "@/frontend/components/layout/page-header";

export default function LoadingJobPostings() {
  return (
    <div
      className="recruiter-management"
      role="status"
      aria-busy="true"
      aria-label="Loading job postings"
    >
      <PageHeader
        className="recruiter-management__page-header"
        eyebrow="Recruiter workspace"
        title="Job postings"
        subtitle="Loading your openings and hiring activity."
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
