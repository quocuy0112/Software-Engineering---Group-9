"use client";

import { useState } from "react";
import { TotpEnrollment } from "./totp-enrollment";
import { TwoFactorManagement } from "./two-factor-management";

export function ProfileSecurity({
  initialTwoFactorEnabled,
}: {
  initialTwoFactorEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialTwoFactorEnabled);

  return (
    <div className="security-grid">
      {enabled ? (
        <TwoFactorManagement onDisabled={() => setEnabled(false)} />
      ) : (
        <TotpEnrollment onEnabled={() => setEnabled(true)} />
      )}
    </div>
  );
}
