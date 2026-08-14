import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { SupportAccountRecoveryGuide } from "@/frontend/features/support/components/support-account-recovery-guide";
import "@/frontend/features/support/styles/support-help.css";

export const metadata = { title: "SmartHire Account Recovery" };

export default async function SupportAccountRecoveryPage() {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Fsupport%2Faccount-recovery");
  return <SupportAccountRecoveryGuide />;
}
