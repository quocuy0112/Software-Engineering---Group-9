import { AccountRecoveryRequestForm } from "@/frontend/features/authentication/components/auth/account-recovery-request-form";

export default async function AccountRecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ invalidLink?: string }>;
}) {
  const { invalidLink } = await searchParams;
  return (
    <AccountRecoveryRequestForm
      initialStatus={
        invalidLink === "1"
          ? "This account-recovery link is invalid, expired, or already used."
          : undefined
      }
    />
  );
}
