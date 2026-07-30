"use client";

import { useState } from "react";
import { TotpEnrollment } from "./totp-enrollment";
import { TwoFactorManagement } from "./two-factor-management";

export function ProfileSecurity({
  initialTwoFactorEnabled,
  recoveryCompleted = false,
}: {
  initialTwoFactorEnabled: boolean;
  recoveryCompleted?: boolean;
}) {
  const [enabled, setEnabled] = useState(initialTwoFactorEnabled);

  return (
    <div className="security-grid">
      {recoveryCompleted && !enabled ? (
        <div className="security-recovery-notice" role="status">
          Account recovery is complete. Re-enroll two-factor authentication
          after signing in to restore stronger protection.
        </div>
      ) : null}
      {enabled ? (
        <TwoFactorManagement onDisabled={() => setEnabled(false)} />
      ) : (
        <TotpEnrollment onEnabled={() => setEnabled(true)} />
      )}
    </div>
  );
}
