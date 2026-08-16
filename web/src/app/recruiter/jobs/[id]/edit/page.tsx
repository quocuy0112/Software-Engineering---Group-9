import { redirect } from "next/navigation";
import { recruiterRoutes } from "@/shared/routing/recruiter-routes";

export const dynamic = 'force-dynamic';

export default async function RecruiterEditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(recruiterRoutes.jobPostingEdit(id));
}
