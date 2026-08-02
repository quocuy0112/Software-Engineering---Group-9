"use client";

import Link from "next/link";
import type { CandidateProfileContract } from "@/shared/contracts/account/profile";
import { Badge } from "@/frontend/components/ui/badge";
import { useProfileEditor } from "../client/use-profile-editor";
import { ProfileNavigation } from "./profile-navigation";
import { ProfileBasicsForm } from "./profile-basics-form";
import { ProfileSkillsForm } from "./profile-skills-form";
import { ProfileExperienceForm } from "./profile-experience-form";
import { ProfileEducationForm } from "./profile-education-form";
import { ProfileSocialLinksForm } from "./profile-social-links-form";
import { ProfileAvatarEditor } from "./profile-avatar-editor";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";

type ProfileOverviewProps = {
  account: {
    name: string;
    email: string;
    image?: string | null;
    memberSince: string;
    twoFactorEnabled: boolean;
  };
  initialProfile?: CandidateProfileContract;
  csrfProof?: string;
};

export function ProfileOverview({
  account,
  initialProfile,
  csrfProof = "",
}: ProfileOverviewProps) {
  const locale = useWorkspaceLocale();
  const copy =
    locale === "vi"
      ? {
          loading: "Đang tải hồ sơ nghề nghiệp…",
          loadError: "Không thể tải hồ sơ nghề nghiệp của bạn.",
          retry: "Thử lại",
          kicker: "TÀI KHOẢN SMARTHIRE CỦA BẠN",
          title: "Hồ sơ",
          subtitle:
            "Quản lý tài khoản và cập nhật thông tin nghề nghiệp của bạn.",
          enabled2fa: "Đã bật 2FA",
          recommended2fa: "Nên bật 2FA",
          account: "CHI TIẾT TÀI KHOẢN",
          email: "Địa chỉ email",
          status: "Trạng thái tài khoản",
          active: "Đang hoạt động",
          memberSince: "Thành viên từ",
          manage: "Quản lý tài khoản",
          security: "BẢO MẬT",
          securityTitle: "Giữ tài khoản của bạn an toàn",
          securityCopy:
            "Quản lý mật khẩu, ứng dụng xác thực, mã dự phòng và các phiên đăng nhập.",
          securityAction: "Mở cài đặt bảo mật",
          story: "CÂU CHUYỆN NGHỀ NGHIỆP",
          professional: "Hồ sơ nghề nghiệp",
          updated: "Đã cập nhật",
          ready: "SẴN SÀNG KHI BẠN MUỐN",
          emptyTitle: "Hồ sơ nghề nghiệp của bạn chưa được hoàn thiện",
          emptyCopy:
            "Bắt đầu với tiêu đề nghề nghiệp, sau đó bổ sung những thông tin bạn muốn giới thiệu.",
          start: "Bắt đầu chỉnh sửa",
          overviewLabel: "Tổng quan hồ sơ",
        }
      : {
          loading: "Loading professional profile…",
          loadError: "Unable to load your professional profile.",
          retry: "Try again",
          kicker: "YOUR SMARTHIRE ACCOUNT",
          title: "Profile",
          subtitle:
            "Manage your account and keep your professional information current.",
          enabled2fa: "2FA enabled",
          recommended2fa: "2FA recommended",
          account: "ACCOUNT DETAILS",
          email: "Email address",
          status: "Account status",
          active: "Active",
          memberSince: "Member since",
          manage: "Manage account",
          security: "SECURITY",
          securityTitle: "Keep your account protected",
          securityCopy:
            "Manage your password, authenticator, backup codes, and active sessions from one secure place.",
          securityAction: "Open security settings",
          story: "YOUR PROFESSIONAL STORY",
          professional: "Professional profile",
          updated: "Updated",
          ready: "READY WHEN YOU ARE",
          emptyTitle: "Your professional profile is not filled yet",
          emptyCopy:
            "Start with a headline, then add only the structured information you want to share.",
          start: "Start editing",
          overviewLabel: "Profile overview",
        };
  const editor = useProfileEditor(initialProfile, csrfProof);

  if (editor.loading) {
    return (
      <div className="profile-page professional-profile-page">
        <p role="status" aria-label={copy.loading}>
          {copy.loading}
        </p>
      </div>
    );
  }

  if (editor.loadError || !editor.profile) {
    return (
      <div className="profile-page professional-profile-page">
        <p role="alert">{copy.loadError}</p>
        <button type="button" onClick={editor.reload}>
          {copy.retry}
        </button>
      </div>
    );
  }

  const profile = editor.profile;

  return (
    <div className="profile-page professional-profile-page">
      <header className="page-heading profile-heading">
        <div>
          <p className="workspace-kicker">{copy.kicker}</p>
          <h1 id="workspace-page-title">{copy.title}</h1>
          <p className="page-heading-copy">{copy.subtitle}</p>
        </div>

        <Badge
          className="page-heading-badge"
          tone={account.twoFactorEnabled ? "success" : "warning"}
        >
          {account.twoFactorEnabled ? copy.enabled2fa : copy.recommended2fa}
        </Badge>
      </header>

      <ProfileNavigation active="overview" />

      <ProfileAvatarEditor
        accountName={account.name}
        initialAvatar={account.image}
        csrfProof={csrfProof}
      />

      <section
        className="profile-overview-grid"
        aria-label={copy.overviewLabel}
      >
        <article className="profile-account-card profile-card">
          <p className="panel-kicker">{copy.account}</p>
          <h2>{account.name}</h2>

          <dl className="profile-account-details">
            <div>
              <dt>{copy.email}</dt>
              <dd>{account.email}</dd>
            </div>
            <div>
              <dt>{copy.status}</dt>
              <dd>{copy.active}</dd>
            </div>
            <div>
              <dt>{copy.memberSince}</dt>
              <dd>{account.memberSince}</dd>
            </div>
          </dl>

          <div className="profile-account-actions">
            <Badge
              className="profile-status-pill"
              tone={account.twoFactorEnabled ? "success" : "warning"}
            >
              {account.twoFactorEnabled ? copy.enabled2fa : copy.recommended2fa}
            </Badge>

            <Link href="/profile/account">{copy.manage}</Link>
          </div>
        </article>

        <article className="profile-card profile-security-card">
          <p className="panel-kicker">{copy.security}</p>
          <h2>{copy.securityTitle}</h2>
          <p>{copy.securityCopy}</p>
          <Link className="profile-card-link" href="/profile/security">
            {copy.securityAction}
          </Link>
        </article>
      </section>

      <section
        className="profile-professional-section"
        aria-labelledby="professional-profile-title"
      >
        <div className="profile-section-heading">
          <div>
            <p className="workspace-kicker">{copy.story}</p>
            <h2 id="professional-profile-title">{copy.professional}</h2>
          </div>

          <Badge tone="info">
            {copy.updated} · {profile.revision}
          </Badge>
        </div>

        {profile.empty ? (
          <section
            className="professional-profile-empty"
            aria-labelledby="empty-title"
          >
            <p className="panel-kicker">{copy.ready}</p>
            <h2 id="empty-title">{copy.emptyTitle}</h2>
            <p>{copy.emptyCopy}</p>
            <button
              type="button"
              onClick={() =>
                document.getElementById("profile-headline")?.focus()
              }
            >
              {copy.start}
            </button>
          </section>
        ) : null}

        <div className="professional-profile-sections">
          <ProfileBasicsForm
            profile={profile}
            saving={editor.savingSection === "basics"}
            feedback={
              editor.feedback?.section === "basics" ? editor.feedback : null
            }
            onSave={editor.save}
          />
          <ProfileSkillsForm
            profile={profile}
            saving={editor.savingSection === "skills"}
            feedback={
              editor.feedback?.section === "skills" ? editor.feedback : null
            }
            onSave={editor.save}
          />
          <ProfileExperienceForm
            profile={profile}
            saving={editor.savingSection === "experience"}
            feedback={
              editor.feedback?.section === "experience" ? editor.feedback : null
            }
            onSave={editor.save}
          />
          <ProfileEducationForm
            profile={profile}
            saving={editor.savingSection === "education"}
            feedback={
              editor.feedback?.section === "education" ? editor.feedback : null
            }
            onSave={editor.save}
          />
          <ProfileSocialLinksForm
            profile={profile}
            saving={editor.savingSection === "socialLinks"}
            feedback={
              editor.feedback?.section === "socialLinks"
                ? editor.feedback
                : null
            }
            onSave={editor.save}
          />
        </div>
      </section>
    </div>
  );
}
