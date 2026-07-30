import { AuthShell } from "@/frontend/features/authentication/components/auth/auth-shell";
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthShell>{children}</AuthShell>;
}
