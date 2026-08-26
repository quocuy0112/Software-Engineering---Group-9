import { PrivateMatchList } from "@/frontend/features/private-cv-match/components/private-match-list";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CvMatchCheckPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const jobId = Array.isArray(params.jobId) ? params.jobId[0] : params.jobId;
  if (jobId) redirect(`/cv-match-check/new?jobId=${encodeURIComponent(jobId)}`);
  return <PrivateMatchList />;
}
