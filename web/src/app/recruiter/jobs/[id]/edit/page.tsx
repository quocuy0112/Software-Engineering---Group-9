import { redirect } from 'next/navigation';
import { getWorkspaceContext } from '@/backend/auth/get-workspace-context';
import { readRecruiterJobManagementData } from '@/backend/services/jobs/recruiter-job-posting-data';
import { RecruiterRouteView } from '@/frontend/features/recruiter-workspace/recruiter-route-view';

export const dynamic = 'force-dynamic';

export default async function RecruiterEditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await getWorkspaceContext();
  if (!context) redirect('/login?returnTo=%2Frecruiter');
  const { id } = await params;
  const data = await readRecruiterJobManagementData(context.userId);
  return <RecruiterRouteView view='edit' jobId={id} initialData={data} />;
}
