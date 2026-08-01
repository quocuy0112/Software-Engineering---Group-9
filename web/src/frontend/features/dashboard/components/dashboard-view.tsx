"use client";

import Link from "next/link";
import { Badge } from "@/frontend/components/ui/badge";
import type { CandidateProfileContract } from "@/shared/contracts/account/profile";
import { useWorkspaceLocale } from "../client/workspace-locale";

export function DashboardView({
  account,
  profile,
}: {
  account: { name: string; hasAvatar: boolean; twoFactorEnabled: boolean };
  profile: CandidateProfileContract;
}) {
  const locale = useWorkspaceLocale();
  const copy =
    locale === "vi"
      ? {
          kicker: "KHÔNG GIAN NGHỀ NGHIỆP CỦA BẠN",
          title: "Tổng quan",
          subtitle:
            "Những thông tin quan trọng và bước tiếp theo, trong một nơi.",
          badge: "Hồ sơ ứng viên",
          welcome: "CHÀO MỪNG TRỞ LẠI",
          heroTitle: (name: string) =>
            `${name}, hãy hoàn thiện dấu ấn nghề nghiệp của bạn.`,
          heroCopy:
            "SmartHire đang tổng hợp tiến độ từ chính hồ sơ và cài đặt bảo mật hiện tại của bạn.",
          completeProfile: "Hoàn thiện hồ sơ",
          viewProfile: "Xem hồ sơ",
          completion: "Mức độ hoàn thiện",
          complete: "hoàn tất",
          profileTitle: "Hồ sơ nghề nghiệp",
          profileCopy:
            "Quản lý giới thiệu, kinh nghiệm, học vấn và kỹ năng của bạn.",
          skills: "kỹ năng",
          experiences: "kinh nghiệm",
          securityTitle: "Bảo mật tài khoản",
          securityCopy:
            "Kiểm soát mật khẩu, xác thực hai lớp và các phiên đăng nhập.",
          protected: "Đã bật 2FA",
          recommended: "Nên bật 2FA",
          preferencesTitle: "Tùy chọn cá nhân",
          preferencesCopy:
            "Chọn ngôn ngữ, múi giờ và thông báo bảo mật phù hợp.",
          configured: "Sẵn sàng",
          nextKicker: "BƯỚC TIẾP THEO",
          nextTitle: "Làm hồ sơ của bạn nổi bật hơn",
          quickKicker: "TRUY CẬP NHANH",
          quickTitle: "Quản lý không gian của bạn",
          basics: "Thêm tiêu đề và phần giới thiệu",
          avatar: "Thêm ảnh đại diện",
          skillsStep: "Thêm kỹ năng nổi bật",
          experienceStep: "Thêm kinh nghiệm làm việc",
          educationStep: "Thêm học vấn",
          socialStep: "Thêm liên kết nghề nghiệp",
          done: "Đã hoàn tất",
          pending: "Cần bổ sung",
          basicsPending: "Tiêu đề từ 20 ký tự và giới thiệu từ 120 ký tự",
          skillsPending: "Thêm ít nhất 3 kỹ năng nổi bật",
          experiencePending: "Thêm ít nhất một kinh nghiệm",
          educationPending: "Thêm ít nhất một học vấn",
          avatarPending: "Tải lên ảnh đại diện rõ nét",
          socialPending: "Thêm ít nhất một hồ sơ hoặc website",
          remaining: (count: number) =>
            count === 0 ? "Đã hoàn thiện" : `Còn ${count} bước`,
          profile: "Hồ sơ",
          profileHint: "Cập nhật thông tin nghề nghiệp",
          preferences: "Tùy chọn",
          preferencesHint: "Ngôn ngữ và múi giờ",
          security: "Bảo mật",
          securityHint: "Mật khẩu, 2FA và mã dự phòng",
          sessions: "Phiên đăng nhập",
          sessionsHint: "Kiểm tra các thiết bị đang đăng nhập",
          shortcuts: "Lối tắt Dashboard",
        }
      : {
          kicker: "YOUR CAREER WORKSPACE",
          title: "Dashboard",
          subtitle: "Your important details and next steps, all in one place.",
          badge: "Candidate profile",
          welcome: "WELCOME BACK",
          heroTitle: (name: string) =>
            `${name}, keep building a profile that feels like you.`,
          heroCopy:
            "SmartHire tracks progress from your real profile and current security settings.",
          completeProfile: "Complete profile",
          viewProfile: "View profile",
          completion: "Profile completion",
          complete: "complete",
          profileTitle: "Professional profile",
          profileCopy:
            "Manage your introduction, experience, education, and skills.",
          skills: "skills",
          experiences: "experiences",
          securityTitle: "Account security",
          securityCopy:
            "Control your password, two-factor authentication, and sessions.",
          protected: "2FA enabled",
          recommended: "2FA recommended",
          preferencesTitle: "Personal preferences",
          preferencesCopy:
            "Choose the language, timezone, and security notices that fit you.",
          configured: "Available",
          nextKicker: "NEXT STEPS",
          nextTitle: "Make your profile stronger",
          quickKicker: "QUICK ACCESS",
          quickTitle: "Manage your workspace",
          basics: "Add a headline and summary",
          avatar: "Add a profile photo",
          skillsStep: "Add your strongest skills",
          experienceStep: "Add work experience",
          educationStep: "Add education",
          socialStep: "Add a professional link",
          done: "Complete",
          pending: "Needs attention",
          basicsPending:
            "Use a 20+ character headline and 120+ character summary",
          skillsPending: "Add at least 3 strong skills",
          experiencePending: "Add at least one experience",
          educationPending: "Add at least one education entry",
          avatarPending: "Upload a clear profile photo",
          socialPending: "Add at least one profile or website",
          remaining: (count: number) =>
            count === 0 ? "Profile ready" : `${count} steps left`,
          profile: "Profile",
          profileHint: "Update your professional details",
          preferences: "Preferences",
          preferencesHint: "Language and timezone",
          security: "Security",
          securityHint: "Password, 2FA, and backup codes",
          sessions: "Sessions",
          sessionsHint: "Review signed-in devices",
          shortcuts: "Dashboard shortcuts",
        };

  const headlineLength = profile.basics.headline?.trim().length ?? 0;
  const summaryLength = profile.basics.summary?.trim().length ?? 0;
  const detailedExperience = profile.experience.some(
    (entry) => (entry.description?.trim().length ?? 0) >= 80,
  );
  const steps = [
    {
      label: copy.basics,
      complete: headlineLength >= 20 && summaryLength >= 120,
      hint: copy.basicsPending,
      href: "/profile#profile-basics-section",
    },
    {
      label: copy.avatar,
      complete: account.hasAvatar,
      hint: copy.avatarPending,
      href: "/profile#profile-avatar-section",
    },
    {
      label: copy.skillsStep,
      complete: profile.skills.length >= 3,
      hint: copy.skillsPending,
      href: "/profile#profile-skills-section",
    },
    {
      label: copy.experienceStep,
      complete: profile.experience.length > 0,
      hint: copy.experiencePending,
      href: "/profile#profile-experience-section",
    },
    {
      label: copy.educationStep,
      complete: profile.education.length > 0,
      hint: copy.educationPending,
      href: "/profile#profile-education-section",
    },
    {
      label: copy.socialStep,
      complete: profile.socialLinks.length > 0,
      hint: copy.socialPending,
      href: "/profile#profile-social-section",
    },
  ];
  const completed = steps.filter((step) => step.complete).length;
  const completion = Math.round(
    (headlineLength >= 20 ? 10 : headlineLength > 0 ? 5 : 0) +
      (summaryLength >= 120 ? 15 : summaryLength > 0 ? 7 : 0) +
      (account.hasAvatar ? 15 : 0) +
      Math.min(profile.skills.length / 3, 1) * 20 +
      (profile.experience.length > 0 ? 15 : 0) +
      (detailedExperience ? 5 : 0) +
      (profile.education.length > 0 ? 10 : 0) +
      (profile.socialLinks.length > 0 ? 10 : 0),
  );
  const remaining = steps.length - completed;

  return (
    <div className="dashboard-page">
      <header className="page-heading">
        <div>
          <p className="workspace-kicker">{copy.kicker}</p>
          <h1 id="workspace-page-title">{copy.title}</h1>
          <p className="page-heading-copy">{copy.subtitle}</p>
        </div>
        <Badge className="page-heading-badge" tone="info">
          {copy.badge}
        </Badge>
      </header>

      <section
        className="dashboard-hero"
        aria-labelledby="dashboard-welcome-title"
      >
        <div className="dashboard-hero-copy">
          <p className="dashboard-hero-eyebrow">{copy.welcome}</p>
          <h2 id="dashboard-welcome-title">{copy.heroTitle(account.name)}</h2>
          <p>{copy.heroCopy}</p>
          <Link className="dashboard-hero-cta" href="/profile">
            {completion < 100 ? copy.completeProfile : copy.viewProfile}
            <DashboardIcon name="arrow" />
          </Link>
        </div>
        <div
          className="dashboard-progress"
          aria-label={`${copy.completion}: ${completion}%`}
        >
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle
              className="dashboard-progress-track"
              cx="60"
              cy="60"
              r="52"
              pathLength="100"
            />
            <circle
              className="dashboard-progress-value"
              cx="60"
              cy="60"
              r="52"
              pathLength="100"
              strokeDasharray={`${completion} 100`}
            />
          </svg>
          <span>
            <strong>{completion}%</strong>
            <small>{copy.complete}</small>
          </span>
        </div>
      </section>

      <section className="dashboard-feature-grid" aria-label={copy.quickTitle}>
        <Link className="feature-card dashboard-current-card" href="/profile">
          <div className="feature-icon" aria-hidden="true">
            <DashboardIcon name="profile" />
          </div>
          <h2>{copy.profileTitle}</h2>
          <p>{copy.profileCopy}</p>
          <span className="dashboard-card-meta">
            {profile.skills.length} {copy.skills} · {profile.experience.length}{" "}
            {copy.experiences}
          </span>
        </Link>
        <Link
          className="feature-card dashboard-current-card"
          href="/profile/security"
        >
          <div className="feature-icon" aria-hidden="true">
            <DashboardIcon name="shield" />
          </div>
          <h2>{copy.securityTitle}</h2>
          <p>{copy.securityCopy}</p>
          <Badge tone={account.twoFactorEnabled ? "success" : "warning"}>
            {account.twoFactorEnabled ? copy.protected : copy.recommended}
          </Badge>
        </Link>
        <Link
          className="feature-card dashboard-current-card"
          href="/profile/preferences"
        >
          <div className="feature-icon" aria-hidden="true">
            <DashboardIcon name="preferences" />
          </div>
          <h2>{copy.preferencesTitle}</h2>
          <p>{copy.preferencesCopy}</p>
          <Badge tone="info">{copy.configured}</Badge>
        </Link>
      </section>

      <div className="dashboard-lower-grid">
        <section
          className="dashboard-panel"
          aria-labelledby="profile-next-steps-title"
        >
          <div className="dashboard-panel-header">
            <div>
              <p className="panel-kicker">{copy.nextKicker}</p>
              <h2 id="profile-next-steps-title">{copy.nextTitle}</h2>
            </div>
            <strong className="dashboard-step-count">
              {copy.remaining(remaining)}
            </strong>
          </div>
          <ul className="account-checklist">
            {steps.map((step) => (
              <li key={step.label} data-complete={step.complete}>
                <Link href={step.href}>
                  <span
                    className={`checklist-icon${step.complete ? "" : "checklist-icon--soft"}`}
                    aria-hidden="true"
                  >
                    <DashboardIcon name={step.complete ? "check" : "plus"} />
                  </span>
                  <span>
                    <strong>{step.label}</strong>
                    <small>{step.complete ? copy.done : step.hint}</small>
                  </span>
                  <span className="shortcut-arrow" aria-hidden="true">
                    <DashboardIcon name="arrow" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="dashboard-panel"
          aria-labelledby="quick-access-title"
        >
          <div className="dashboard-panel-header">
            <div>
              <p className="panel-kicker">{copy.quickKicker}</p>
              <h2 id="quick-access-title">{copy.quickTitle}</h2>
            </div>
          </div>
          <div className="dashboard-links" aria-label={copy.shortcuts}>
            <Link href="/profile">
              <span className="shortcut-icon" aria-hidden="true">
                <DashboardIcon name="profile" />
              </span>
              <span>
                <strong>{copy.profile}</strong>
                <small>{copy.profileHint}</small>
              </span>
              <span className="shortcut-arrow" aria-hidden="true">
                <DashboardIcon name="arrow" />
              </span>
            </Link>
            <Link href="/profile/preferences">
              <span className="shortcut-icon" aria-hidden="true">
                <DashboardIcon name="preferences" />
              </span>
              <span>
                <strong>{copy.preferences}</strong>
                <small>{copy.preferencesHint}</small>
              </span>
              <span className="shortcut-arrow" aria-hidden="true">
                <DashboardIcon name="arrow" />
              </span>
            </Link>
            <Link href="/profile/security">
              <span className="shortcut-icon" aria-hidden="true">
                <DashboardIcon name="shield" />
              </span>
              <span>
                <strong>{copy.security}</strong>
                <small>{copy.securityHint}</small>
              </span>
              <span className="shortcut-arrow" aria-hidden="true">
                <DashboardIcon name="arrow" />
              </span>
            </Link>
            <Link href="/profile/sessions">
              <span className="shortcut-icon" aria-hidden="true">
                <DashboardIcon name="device" />
              </span>
              <span>
                <strong>{copy.sessions}</strong>
                <small>{copy.sessionsHint}</small>
              </span>
              <span className="shortcut-arrow" aria-hidden="true">
                <DashboardIcon name="arrow" />
              </span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function DashboardIcon({
  name,
}: {
  name:
    | "arrow"
    | "check"
    | "device"
    | "plus"
    | "preferences"
    | "profile"
    | "shield"
    | "spark"
    | "team";
}) {
  const paths: Record<typeof name, React.ReactNode> = {
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    check: <path d="m5 12 4 4L19 6" />,
    device: (
      <>
        <rect x="4" y="5" width="16" height="12" rx="2" />
        <path d="M9 20h6" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    preferences: (
      <>
        <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="8" cy="17" r="2" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6" />
      </>
    ),
    shield: (
      <path d="M12 3 5.5 5.5v5.2c0 4.1 2.3 7.6 6.5 9.3 4.2-1.7 6.5-5.2 6.5-9.3V5.5L12 3Zm-3 9 2 2 4-5" />
    ),
    spark: (
      <path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z" />
    ),
    team: (
      <>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2" />
        <path d="M3.5 20c.6-4 2.5-6 5.5-6s4.9 2 5.5 6M14.5 15c2.8-.4 4.8 1.2 5.5 4" />
      </>
    ),
  };

  return (
    <svg className="dashboard-icon" viewBox="0 0 24 24" focusable="false">
      {paths[name]}
    </svg>
  );
}
