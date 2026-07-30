import { LoginForm } from "@/frontend/features/authentication/components/login-form";
import { trustedInternalRedirect } from "@/backend/security/trusted-redirect";
import { serverEnvironment } from "@/backend/env/runtime";
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
