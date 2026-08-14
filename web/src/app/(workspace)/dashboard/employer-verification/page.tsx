import { EmployerVerificationPage } from "@/frontend/features/employer-verification/employer-verification-page";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Page() {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Fdashboard%2Femployer-verification");
  return <EmployerVerificationPage csrfProof={context.csrfProof} />;
}
