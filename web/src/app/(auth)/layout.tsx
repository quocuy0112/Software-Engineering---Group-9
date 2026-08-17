import "../../frontend/styles/auth.css";
import "../../frontend/features/profile/styles/account-identity-email-change.css";
import "../../frontend/styles/responsive.css";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { AuthShell } from "@/frontend/features/authentication/components/auth-shell";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const workspace = await getWorkspaceContext();
  return (
    <AuthShell locale={workspace?.initialLocale ?? "en"}>{children}</AuthShell>
  );
}
