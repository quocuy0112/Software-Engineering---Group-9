"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Bell,
  CalendarDays,
  CircleCheck,
  KeyRound,
  LockKeyhole,
  Mail,
} from "lucide-react";
import type { CandidateProfileContract } from "@/shared/contracts/account/profile";
import { Badge } from "@/frontend/components/ui/badge";
import { Panel, StatusPill } from "@/frontend/components/ui/design-system";
import { InfoRow } from "@/frontend/components/ui/info-row";
import { PageHeader } from "@/frontend/components/layout/page-header";
import { useProfileEditor } from "../client/use-profile-editor";
import { ProfileNavigation } from "./profile-navigation";
import { ProfileBasicsForm } from "./profile-basics-form";
import { ProfileSkillsForm } from "./profile-skills-form";
import { ProfileExperienceForm } from "./profile-experience-form";
import { ProfileEducationForm } from "./profile-education-form";
import { ProfileSocialLinksForm } from "./profile-social-links-form";
import { ProfileAvatarEditor } from "./profile-avatar-editor";
import { AccountIdRow } from "./account-id-row";
import { ProfileIdentityHeader } from "./profile-identity-header";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";

type ProfileOverviewProps = {
  account: {
    id: string;
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
          accountTitle: "Thông tin tài khoản",
          password: "Mật khẩu",
          passwordProtected: "Đã bảo vệ",
          autoSave:
            "Hồ sơ được lưu tự động và mã hoá. Thay đổi gần nhất sẽ hiển thị tại đây.",
          loading: "Đang tải hồ sơ chuyên môn…",
          loadError: "Không thể tải hồ sơ chuyên môn của bạn.",
          retry: "Thử lại",
          kicker: "Hồ sơ của bạn",
          title: "Hồ sơ chuyên môn",
          subtitle:
            "Hoàn thiện các mục bên dưới để nhà tuyển dụng SME dễ tìm thấy và đánh giá đúng năng lực của bạn.",
          enabled2fa: "Xác thực 2 lớp đã bật",
          recommended2fa: "Nên bật xác thực 2 lớp",
          enable2fa: "Bật xác thực 2 bước",
          account: "TÀI KHOẢN",
          accountId: "ID tài khoản",
          copyAccountId: "Sao chép ID tài khoản",
          copiedAccountId: "Đã sao chép ID tài khoản",
          copyAccountIdFailed: "Không thể sao chép ID tài khoản",
          email: "Email",
          status: "Trạng thái",
          active: "Đang hoạt động",
          memberSince: "Tham gia",
          manage: "Quản lý tài khoản",
          security: "BẢO MẬT",
          securityTitle: "Bảo vệ tài khoản",
          securityCopy:
            "Quản lý mật khẩu, ứng dụng xác thực, mã dự phòng và các phiên đăng nhập.",
          securityAction: "Quản lý bảo mật",
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
          kicker: "YOUR PROFILE",
          title: "Professional profile",
          subtitle:
            "Complete the sections below so employers can quickly understand your strengths and experience.",
          enabled2fa: "2FA enabled",
          recommended2fa: "2FA recommended",
          enable2fa: "Enable two-factor authentication",
          account: "ACCOUNT",
          accountTitle: "Account information",
          accountId: "Account ID",
          copyAccountId: "Copy account ID",
          copiedAccountId: "Account ID copied",
          copyAccountIdFailed: "Account ID could not be copied",
          email: "Email",
          status: "Status",
          active: "Active",
          memberSince: "Member since",
          manage: "Manage account",
          security: "SECURITY",
          securityTitle: "Account protection",
          securityCopy:
            "Manage your password, authenticator, backup codes, and active sessions from one secure place.",
          securityAction: "Manage security",
          password: "Password",
          passwordProtected: "Protected",
          autoSave:
            "Your profile is saved automatically and encrypted. Latest changes will appear here.",
          story: "PROFESSIONAL STORY",
          professional: "Your professional story",
          updated: "Updated",
          ready: "READY WHEN YOU ARE",
          emptyTitle: "Your professional profile is not filled yet",
          emptyCopy:
            "Start with a headline, then add only the structured information you want to share.",
          start: "Start editing",
          overviewLabel: "Profile overview",
        };
  const editor = useProfileEditor(initialProfile, csrfProof);
  const [avatar, setAvatar] = useState(account.image ?? null);
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);

  if (editor.loading) {
    return (
      <div className="candidate-profile-page">
        <p role="status" aria-label={copy.loading}>
          {copy.loading}
        </p>
      </div>
    );
  }

  if (editor.loadError || !editor.profile) {
    return (
      <div className="candidate-profile-page">
        <p role="alert">{copy.loadError}</p>
        <button type="button" onClick={editor.reload}>
          {copy.retry}
        </button>
      </div>
    );
  }

  const profile = editor.profile;

  return (
    <div className="candidate-profile-page">
      <ProfileNavigation active="overview" accountName={account.name} />

      <PageHeader
        className="candidate-profile-page__header"
        eyebrow={copy.kicker}
        title={copy.title}
        titleId="workspace-page-title"
        subtitle={copy.subtitle}
        status={{
          label: locale === "vi" ? "Tự động lưu" : "Auto-save",
          tone: "success",
          pulsing: true,
        }}
      />

      <ProfileIdentityHeader
        profile={profile}
        avatar={avatar}
        locale={locale}
        accountName={account.name}
        onEditAvatar={() => setAvatarEditorOpen(true)}
      />

      <ProfileAvatarEditor
        accountName={account.name}
        initialAvatar={account.image}
        csrfProof={csrfProof}
        compact
        open={avatarEditorOpen}
        onOpenChange={setAvatarEditorOpen}
        onAvatarChanged={setAvatar}
      />

      <section
        className="candidate-profile-page__overview"
        aria-label={copy.overviewLabel}
      >
        <Panel
          as="article"
          className="candidate-profile-page__account-card"
          eyebrow={copy.account}
          title={copy.accountTitle}
          titleId="profile-account-title"
        >
          <dl className="profile-account-details">
            <InfoRow
              asDefinition
              icon={<Badge tone="blue" icon={<Mail />} aria-hidden="true" />}
              label={copy.email}
              value={account.email}
            />
            <InfoRow
              asDefinition
              icon={
                <Badge tone="blue" icon={<CalendarDays />} aria-hidden="true" />
              }
              label={copy.memberSince}
              value={account.memberSince}
            />
            <InfoRow
              asDefinition
              icon={
                <Badge tone="blue" icon={<CircleCheck />} aria-hidden="true" />
              }
              label={copy.status}
              value={copy.active}
              valueTone="success"
            />
            <AccountIdRow
              accountId={account.id}
              label={copy.accountId}
              copyLabel={copy.copyAccountId}
              copiedLabel={copy.copiedAccountId}
              failedLabel={copy.copyAccountIdFailed}
              icon={
                <Badge tone="blue" icon={<KeyRound />} aria-hidden="true" />
              }
            />
          </dl>

          <div className="profile-account-actions">
            <Link className="btn-ghost" href="/profile/account">
              {copy.manage}
            </Link>
          </div>
        </Panel>

        <Panel
          as="article"
          className="candidate-profile-page__security-card"
          eyebrow={copy.security}
          title={copy.securityTitle}
          titleId="profile-security-title"
        >
          <StatusPill
            className="profile-security-status"
            label={
              account.twoFactorEnabled ? copy.enabled2fa : copy.recommended2fa
            }
            tone={account.twoFactorEnabled ? "success" : "warning"}
          />
          <InfoRow
            icon={
              <Badge tone="blue" icon={<LockKeyhole />} aria-hidden="true" />
            }
            label={copy.password}
            value={<strong>{copy.passwordProtected}</strong>}
          />
          <Link
            className="btn-ghost candidate-profile-page__security-action"
            href="/profile/security"
          >
            {copy.securityAction}
          </Link>
        </Panel>
      </section>

      <section
        className="candidate-profile-page__professional"
        aria-label={copy.professional}
      >
        <div
          className="candidate-profile-page__legacy-heading"
          aria-hidden="true"
        >
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
            className="candidate-profile-page__empty"
            aria-labelledby="empty-title"
          >
            <p className="candidate-profile-page__empty-kicker">{copy.ready}</p>
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

        <div className="candidate-profile-page__sections">
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

      <div className="candidate-profile-page__notice" role="note">
        <Badge
          tone="amber"
          className="candidate-profile-page__notice-icon"
          icon={<Bell />}
          aria-hidden="true"
        />
        <p>{copy.autoSave}</p>
      </div>
    </div>
  );
}
