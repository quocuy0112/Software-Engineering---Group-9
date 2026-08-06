import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { serverEnvironment } from "@/backend/env/runtime";
import { JobDiscoveryService } from "@/backend/services/jobs/job-discovery-service";
import { JobServiceError } from "@/backend/services/jobs/job-types";
import { optionalJobActor } from "@/backend/security/job-request-boundary";
import { JobDetailView } from "@/frontend/features/jobs/components/job-detail";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function load(slug: string) {
  const actor = await optionalJobActor(await headers());
  return new JobDiscoveryService().detail(
    slug,
    actor,
    new Date(),
    serverEnvironment.NEXT_PUBLIC_APP_URL,
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const job = await load((await params).slug);
    return {
      title: `${job.title} · ${job.company.displayName}`,
      description: job.summary,
      alternates: { canonical: job.canonicalUrl },
    };
  } catch {
    return {
      title: "Job unavailable · SmartHire",
      robots: { index: false, follow: false },
    };
  }
}

export default async function JobDetailPage({ params }: Props) {
  let job: Awaited<ReturnType<typeof load>> | null = null;
  let failed = false;
  try {
    job = await load((await params).slug);
  } catch (error) {
    if (error instanceof JobServiceError && error.status === 404) notFound();
    failed = true;
  }
  if (failed || !job) {
    return (
      <div className="jobs-page jobs-detail-page">
        <div className="job-panel job-feedback" role="alert">
          <h1>Job details could not be loaded</h1>
          <p>Try again in a moment.</p>
          <Link className="job-secondary-link" href="/jobs">
            Back to jobs
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="jobs-page jobs-detail-page">
      <JobDetailView job={job} />
    </div>
  );
}
