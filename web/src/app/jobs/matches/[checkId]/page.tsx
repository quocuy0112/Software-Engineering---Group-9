import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PrivateMatchReportRoute({
  params,
}: {
  params: Promise<{ checkId: string }>;
}) {
  const checkId = (await params).checkId;
  redirect(`/cv-match-check/${encodeURIComponent(checkId)}`);
}
