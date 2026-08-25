"use client";

import { ProfileNavigation } from "./profile-navigation";
import { ProfileSecurity } from "./profile-security";
import { PageHeader } from "@/frontend/components/layout/page-header";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import type { CandidateProfileContract } from "@/shared/contracts/account/profile";
import { useProfileEditor } from "../client/use-profile-editor";
import { ProfileVisibilityForm } from "./profile-visibility-form";

type ProfileSecurityViewProps = {
  twoFactorEnabled: boolean;
  recoveryCompleted: boolean;
  csrfProof: string;
  initialProfile: CandidateProfileContract;
};

export function ProfileSecurityView({
  twoFactorEnabled,
  recoveryCompleted,
  csrfProof,
  initialProfile,
}: ProfileSecurityViewProps) {
  const locale = useWorkspaceLocale();
  const editor = useProfileEditor(initialProfile, csrfProof);
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
      <ProfileNavigation active="security" />
      <PageHeader
        className="profile-heading"
        eyebrow={copy.kicker}
        title={copy.title}
        titleId="workspace-page-title"
        subtitle={copy.subtitle}
        status={{
          label: twoFactorEnabled ? copy.enabled : copy.recommended,
          tone: twoFactorEnabled ? "success" : "warning",
        }}
      />
      <div className="profile-security-layout">
        <div className="profile-security-layout__privacy">
          {editor.profile ? (
            <ProfileVisibilityForm
              profile={editor.profile}
              saving={editor.savingSection === "visibility"}
              feedback={
                editor.feedback?.section === "visibility"
                  ? editor.feedback
                  : null
              }
              onSave={editor.save}
            />
          ) : null}
        </div>
        <div className="profile-security-layout__account">
          <ProfileSecurity
            initialTwoFactorEnabled={twoFactorEnabled}
            recoveryCompleted={recoveryCompleted}
            csrfProof={csrfProof}
          />
        </div>
      </div>
    </div>
  );
}
