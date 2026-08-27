import { AccountRecoveryRequestForm } from "@/frontend/features/authentication/components/account-recovery-request-form";

export default async function AccountRecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ invalidLink?: string }>;
}) {
  const { invalidLink } = await searchParams;
  return (
    <AccountRecoveryRequestForm
      initialStatus={invalidLink === "1" ? "invalid-link" : undefined}
    />
  );
}
