import "../../frontend/styles/auth.css";
import "../../frontend/features/profile/styles/account-identity-email-change.css";
import { AuthShell } from "@/frontend/features/authentication/components/auth-shell";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthShell>{children}</AuthShell>;
}
