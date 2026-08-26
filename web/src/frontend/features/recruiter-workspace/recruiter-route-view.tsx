"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { JobPostingEditor } from "./job-posting-editor";
import { RecruiterJobPostingManagement } from "./job-posting-management";
import {
  createEmptyJobPosting,
  type RecruiterJob,
  type RecruiterJobManagementData,
} from "@/shared/contracts/recruiter-job-posting";
import { recruiterRoutes } from "@/shared/routing/recruiter-routes";
import type { RecruiterJobPostingTab } from "@/shared/routing/recruiter-routes";
import { collectRecruiterSubIndustrySuggestions } from "@/shared/contracts/jobs/industry-taxonomy";

type RecruiterRouteViewProps = {
  view: "list" | "create" | "edit";
  initialData: RecruiterJobManagementData;
  jobId?: string;
  initialTab?: RecruiterJobPostingTab;
  initialCompanyId?: string;
};

export function RecruiterRouteView({
  view,
  initialData,
  jobId,
  initialTab,
  initialCompanyId,
}: RecruiterRouteViewProps) {
  const router = useRouter();
  const selectedCompany =
    initialData.companies.find((item) => item.id === initialCompanyId) ??
    initialData.companies.find((item) => item.id === initialData.companyId);

  useEffect(() => {
    // A previously visited edit route can be restored from the App Router
    // cache. Force one server refresh on entry so the editor hydrates from the
    // latest catalogue snapshot after an AutoSave made in another route
    // bundle.
    if (view === "edit") router.refresh();
  }, [jobId, router, view]);

  if (view === "list") {
    return (
      <RecruiterJobPostingManagement
        initialData={initialData}
        initialTab={initialTab}
        onNavigate={(href) => router.push(href)}
        onTabChange={(tab) =>
          router.replace(recruiterRoutes.jobPostingsForTab(tab), {
            scroll: false,
          })
        }
      />
    );
  }

  if (!initialData.companyId) {
    return <RecruiterJobPostingManagement initialData={initialData} />;
  }

  const targetCompany =
    selectedCompany ??
    initialData.companies.find((item) => item.id === initialData.companyId);
  const targetCompanyId = targetCompany?.id ?? initialData.companyId;

  const job =
    view === "edit"
      ? initialData.jobs.find((item) => item.id === jobId)
      : ({
          ...createEmptyJobPosting(targetCompanyId),
          company:
            initialData.companies.find((item) => item.id === targetCompanyId) ??
            initialData.companies[0],
        } as RecruiterJob);

  if (!job) {
    return (
      <section className="recruiter-empty-state recruiter-surface-card">
        <h1>Job posting not found</h1>
        <p>This posting may have been removed or is no longer available.</p>
        <button
          className="recruiter-primary-button"
          type="button"
          onClick={() => router.replace(recruiterRoutes.jobPostings)}
        >
          Back to job postings
        </button>
      </section>
    );
  }

  const returnToJobPostings = () => {
    // The list page can be retained in the App Router cache while the editor
    // is open. Refresh after returning so its draft card cannot reuse the
    // pre-edit server snapshot.
    router.replace(recruiterRoutes.jobPostings);
    window.setTimeout(() => router.refresh(), 0);
  };

  return (
    <JobPostingEditor
      key={view === "edit" ? `${job.id}:${job.updatedAt}` : undefined}
      initialJob={job}
      companyName={job.company.name}
      autoSavePreferenceScope={initialData.recruiterUserId}
      subIndustrySuggestions={collectRecruiterSubIndustrySuggestions(
        initialData.jobs,
      )}
      awaitDraftSaveBeforeBack
      onBack={returnToJobPostings}
      onSaved={returnToJobPostings}
    />
  );
}
