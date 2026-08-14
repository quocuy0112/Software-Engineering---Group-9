import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { SupportFaq } from "@/frontend/features/support/components/support-faq";
import "@/frontend/features/support/styles/support-help.css";

export const metadata = { title: "SmartHire FAQ" };

export default async function SupportFaqPage() {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Fsupport%2Ffaq");
  return <SupportFaq />;
}
