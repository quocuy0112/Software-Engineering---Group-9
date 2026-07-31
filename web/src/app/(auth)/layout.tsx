import "../../frontend/styles/auth.css";
import "../../frontend/styles/responsive.css";
import { AuthShell } from "@/frontend/features/authentication/components/auth-shell";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthShell>{children}</AuthShell>;
}
