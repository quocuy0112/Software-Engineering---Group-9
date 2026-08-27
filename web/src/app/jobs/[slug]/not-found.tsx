import Link from "next/link";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { jobCopy } from "@/frontend/features/jobs/components/job-copy";

export default async function JobUnavailable() {
  const context = await getWorkspaceContext();
  const copy = jobCopy(context?.initialLocale ?? "en");
  return (
    <main className="jobs-shell">
      <div className="jobs-container">
        <section className="job-panel">
          <h1>{copy.unavailableTitle}</h1>
          <p>{copy.unavailableDescription}</p>
          <Link href="/jobs">{copy.browseActiveJobs}</Link>
        </section>
      </div>
    </main>
  );
}
