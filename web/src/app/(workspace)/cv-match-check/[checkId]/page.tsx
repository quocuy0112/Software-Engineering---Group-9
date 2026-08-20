import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { PrivateMatchPageClient } from "@/frontend/features/private-cv-match/components/private-match-page-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PrivateMatchReportRoute({
  params,
}: {
  params: Promise<{ checkId: string }>;
}) {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Fcv-match-check");
  const checkId = (await params).checkId;
  return <PrivateMatchPageClient checkId={checkId} />;
}
