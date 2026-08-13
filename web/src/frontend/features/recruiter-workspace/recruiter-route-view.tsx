'use client';

import { useRouter } from 'next/navigation';
import { JobPostingEditor } from './job-posting-editor';
import { RecruiterJobPostingManagement } from './job-posting-management';
import {
  createEmptyJobPosting,
  type RecruiterJobManagementData,
} from '@/shared/contracts/recruiter-job-posting';

type RecruiterRouteViewProps = {
  view: 'list' | 'create' | 'edit';
  initialData: RecruiterJobManagementData;
  jobId?: string;
};

export function RecruiterRouteView({
  view,
  initialData,
  jobId,
}: RecruiterRouteViewProps) {
  const router = useRouter();
  const companyName = initialData.companies[0]?.name ?? 'Your company';

  if (view === 'list') {
    return (
      <RecruiterJobPostingManagement
        initialData={initialData}
        onNavigate={(href) => router.push(href)}
      />
    );
  }

  if (!initialData.companyId) {
    return <RecruiterJobPostingManagement initialData={initialData} />;
  }

  const job =
    view === 'edit'
      ? initialData.jobs.find((item) => item.id === jobId)
      : createEmptyJobPosting(initialData.companyId);

  if (!job) {
    return (
      <section className='recruiter-empty-state recruiter-surface-card'>
        <h1>Job posting not found</h1>
        <p>This posting may have been removed or is no longer available.</p>
        <button
          className='recruiter-primary-button'
          type='button'
          onClick={() => router.replace('/recruiter')}
        >
          Back to job postings
        </button>
      </section>
    );
  }

  return (
    <JobPostingEditor
      initialJob={job}
      companyName={companyName}
      onBack={() => router.back()}
      onSaved={() => router.replace('/recruiter')}
    />
  );
}
