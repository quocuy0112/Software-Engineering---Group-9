"use client";

import { useState } from "react";
import { TotpEnrollment } from "./totp-enrollment";
import { TwoFactorManagement } from "./two-factor-management";
import { PasswordChangeForm } from "./password-change-form";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";

export function ProfileSecurity({
  initialTwoFactorEnabled,
  recoveryCompleted = false,
  csrfProof,
}: {
  initialTwoFactorEnabled: boolean;
  recoveryCompleted?: boolean;
  csrfProof: string;
}) {
  const [enabled, setEnabled] = useState(initialTwoFactorEnabled);
  const locale = useWorkspaceLocale();

  return (
    <div className="security-grid">
      {recoveryCompleted && !enabled ? (
        <div className="security-recovery-notice" role="status">
          {locale === "vi"
            ? "Khôi phục tài khoản đã hoàn tất. Hãy đăng ký lại xác thực hai lớp sau khi đăng nhập để tăng cường bảo vệ."
            : "Account recovery is complete. Re-enroll two-factor authentication after signing in to restore stronger protection."}
        </div>
      ) : null}
      {enabled ? (
        <TwoFactorManagement onDisabled={() => setEnabled(false)} />
      ) : (
        <TotpEnrollment onEnabled={() => setEnabled(true)} />
      )}
      <PasswordChangeForm csrfProof={csrfProof} />
    </div>
  );
}
