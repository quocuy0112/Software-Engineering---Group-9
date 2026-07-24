import { LoginForm } from "@/components/auth/login-form";
import { trustedInternalRedirect } from "@/lib/security/trusted-redirect";
import { serverEnvironment } from "@/lib/env/runtime";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const value = (await searchParams).returnTo;
  return (
    <LoginForm
      returnTo={trustedInternalRedirect(
        value,
        serverEnvironment.NEXT_PUBLIC_APP_URL,
        "/dashboard",
      )}
    />
  );
}
