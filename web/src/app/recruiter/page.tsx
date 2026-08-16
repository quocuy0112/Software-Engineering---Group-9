import { redirect } from "next/navigation";
import { recruiterRoutes } from "@/shared/routing/recruiter-routes";

export const dynamic = "force-dynamic";

export default function RecruiterPage() {
  redirect(recruiterRoutes.jobPostings);
}
