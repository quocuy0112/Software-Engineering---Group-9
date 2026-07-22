import { TotpEnrollment } from "@/components/auth/totp-enrollment";
import { TwoFactorManagement } from "@/components/auth/two-factor-management";

export default function SecurityPage() {
  return (
    <>
      <h1 id="workspace-page-title">Security</h1>
      <TotpEnrollment />
      <TwoFactorManagement />
    </>
  );
}
