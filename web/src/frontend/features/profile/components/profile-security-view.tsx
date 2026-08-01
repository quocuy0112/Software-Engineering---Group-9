"use client";

import { ProfileNavigation } from "./profile-navigation";
import { ProfileSecurity } from "./profile-security";
import { Badge } from "@/frontend/components/ui/badge";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";

type ProfileSecurityViewProps = {
  twoFactorEnabled: boolean;
  recoveryCompleted: boolean;
  csrfProof: string;
};

export function ProfileSecurityView({
  twoFactorEnabled,
  recoveryCompleted,
  csrfProof,
}: ProfileSecurityViewProps) {
  const locale = useWorkspaceLocale();
  const copy =
    locale === "vi"
      ? {
          kicker: "TÀI KHOẢN & TRUY CẬP",
          title: "Bảo mật",
          subtitle:
            "Xác nhận mật khẩu trước khi thay đổi các cài đặt quan trọng.",
          enabled: "Đã bật 2FA",
          recommended: "Nên bật 2FA",
        }
      : {
          kicker: "ACCOUNT & ACCESS",
          title: "Security",
          subtitle:
            "Confirm your password before changing high-impact settings.",
          enabled: "2FA enabled",
          recommended: "2FA recommended",
        };
  return (
    <div className="profile-page profile-page--standalone">
      <header className="page-heading profile-heading">
        <div>
          <p className="workspace-kicker">{copy.kicker}</p>
          <h1 id="workspace-page-title">{copy.title}</h1>
          <p className="page-heading-copy">{copy.subtitle}</p>
        </div>
        <Badge tone={twoFactorEnabled ? "success" : "warning"}>
          {twoFactorEnabled ? copy.enabled : copy.recommended}
        </Badge>
      </header>
      <ProfileNavigation active="security" />
      <ProfileSecurity
        initialTwoFactorEnabled={twoFactorEnabled}
        recoveryCompleted={recoveryCompleted}
        csrfProof={csrfProof}
      />
    </div>
  );
}
