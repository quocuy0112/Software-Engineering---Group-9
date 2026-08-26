"use client";

import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BriefcaseBusiness,
  FileSearch,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Badge } from "@/frontend/components/ui/badge";
import { Button } from "@/frontend/components/ui/button";
import { ChecklistRow } from "@/frontend/components/ui/checklist-row";
import { FeatureCard } from "@/frontend/components/ui/feature-card";
import { Panel } from "@/frontend/components/ui/design-system";
import { ProgressRing } from "@/frontend/components/ui/progress-ring";
import { PageHeader } from "@/frontend/components/layout/page-header";
import {
  computeProfileCompleteness,
  getProfileCompletion,
  type ProfileCompletionSection,
} from "@/frontend/features/profile/lib/profile-completeness";
import { pluralize } from "@/shared/utils/pluralize";
import { useWorkspaceLocale } from "../client/workspace-locale";
import type { CandidateProfileContract } from "@/shared/contracts/account/profile";

export function DashboardView({
  account,
  profile,
}: {
  account: { name: string; hasAvatar: boolean; twoFactorEnabled: boolean };
  profile: CandidateProfileContract;
}) {
  const router = useRouter();
  const locale = useWorkspaceLocale();
  const copy = dashboardCopy(locale);
  const profileCompletion = getProfileCompletion(profile, account.hasAvatar);
  const completion = computeProfileCompleteness(profile, account.hasAvatar);
  const steps = profileCompletion.items.map((item) => ({
    ...item,
    label: copy.steps[item.key].label,
    hint: copy.steps[item.key].hint,
  }));
  const remaining = steps.filter((step) => !step.complete).length;

  return (
    <div className="candidate-dashboard-page">
      <PageHeader
        eyebrow={copy.kicker}
        title={copy.title}
        subtitle={copy.subtitle}
        rightSlot={<Badge tone="info">{copy.badge}</Badge>}
      />

      <Panel
        className="candidate-dashboard-hero"
        accentBorder="blue"
        showDivider={false}
        eyebrow={copy.welcome}
        title={copy.heroTitle(account.name)}
        titleId="dashboard-welcome-title"
        rightSlot={
          <ProgressRing
            percent={completion}
            label={copy.completion}
            caption={copy.complete}
          />
        }
      >
        <p>{copy.heroCopy}</p>
        <Button onClick={() => router.push("/profile")}>
          {completion < 100 ? copy.completeProfile : copy.viewProfile}
          <ArrowRight aria-hidden="true" />
        </Button>
      </Panel>

      <section
        className="candidate-dashboard-grid"
        aria-label={copy.workspaceSections}
      >
        <FeatureCard
          href="/profile"
          icon={<UserRound />}
          title={copy.profileTitle}
          description={copy.profileCopy}
          footer={
            <span className="sh-count-pill">
              {profile.skills.length}{" "}
              {pluralize(profile.skills.length, copy.skill, copy.skills)}
              {" · "}
              {profile.experience.length}{" "}
              {pluralize(
                profile.experience.length,
                copy.experience,
                copy.experiences,
              )}
            </span>
          }
        />
        <FeatureCard
          href="/jobs"
          icon={<BriefcaseBusiness />}
          title={copy.jobsTitle}
          description={copy.jobsCopy}
          footer={<Badge tone="info">{copy.browseJobs}</Badge>}
        />
        <FeatureCard
          href="/cv-match-check"
          icon={<FileSearch />}
          title={copy.matchTitle}
          description={copy.matchCopy}
          footer={<Badge tone="info">{copy.openMatch}</Badge>}
        />
        <FeatureCard
          href="/profile/security"
          icon={<ShieldCheck />}
          tone="teal"
          title={copy.securityTitle}
          description={copy.securityCopy}
          footer={
            <Badge tone={account.twoFactorEnabled ? "success" : "warning"}>
              {account.twoFactorEnabled ? copy.protected : copy.recommended}
            </Badge>
          }
        />
      </section>

      <Panel
        className="candidate-dashboard-steps"
        eyebrow={copy.nextKicker}
        title={copy.nextTitle}
        titleId="profile-next-steps-title"
        rightSlot={
          <span className="candidate-dashboard-steps__count">
            {copy.stepsLeft(remaining)}
          </span>
        }
      >
        <ul className="sh-checklist">
          {steps.map((step) => (
            <ChecklistRow
              key={step.key}
              status={step.complete ? "done" : "todo"}
              title={step.label}
              subtitle={step.complete ? copy.done : step.hint}
              onClick={() => router.push(`/profile#${step.targetId}`)}
            />
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function dashboardCopy(locale: "vi" | "en") {
  if (locale === "vi") {
    return {
      kicker: "KHÔNG GIAN NGHỀ NGHIỆP",
      title: "Bảng điều khiển",
      subtitle:
        "Thông tin quan trọng và bước tiếp theo của bạn, ở cùng một nơi.",
      badge: "Hồ sơ ứng viên",
      welcome: "CHÀO MỪNG TRỞ LẠI",
      heroTitle: (name: string) =>
        `${name}, hãy tiếp tục hoàn thiện hồ sơ của bạn.`,
      heroCopy:
        "SmartHire theo dõi tiến độ từ hồ sơ và cài đặt bảo mật hiện tại của bạn.",
      completeProfile: "Hoàn thiện hồ sơ",
      viewProfile: "Xem hồ sơ",
      completion: "Mức độ hoàn thiện hồ sơ",
      complete: "hoàn tất",
      profileTitle: "Hồ sơ chuyên nghiệp",
      profileCopy: "Quản lý phần giới thiệu, kinh nghiệm, học vấn và kỹ năng.",
      skill: "kỹ năng",
      skills: "kỹ năng",
      experience: "kinh nghiệm",
      experiences: "kinh nghiệm",
      jobsTitle: "Cơ hội việc làm",
      jobsCopy: "Tìm, lọc, lưu hoặc ứng tuyển vào các vị trí đang mở.",
      browseJobs: "Tìm việc",
      matchTitle: "Kiểm tra độ phù hợp CV",
      matchCopy:
        "Xem CV của bạn phù hợp với một công việc đến đâu trước khi ứng tuyển. Báo cáo chỉ mình bạn xem.",
      openMatch: "Kiểm tra CV",
      securityTitle: "Bảo mật tài khoản",
      securityCopy:
        "Quản lý mật khẩu, xác thực hai lớp và các phiên đăng nhập.",
      protected: "Đã bật 2FA",
      recommended: "Nên bật 2FA",
      nextKicker: "BƯỚC TIẾP THEO",
      nextTitle: "Làm hồ sơ của bạn nổi bật hơn",
      done: "Hoàn tất",
      stepsLeft: (count: number) =>
        count === 0
          ? "Hồ sơ đã sẵn sàng"
          : `Còn ${count} ${pluralize(count, "bước", "bước")}`,
      steps: profileStepCopy("vi"),
      workspaceSections: "Khu vực quản lý việc làm, hồ sơ và tài khoản",
    };
  }

  return {
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
    profileCopy: "Manage your introduction, experience, education, and skills.",
    skill: "skill",
    skills: "skills",
    experience: "experience",
    experiences: "experiences",
    jobsTitle: "Job opportunities",
    jobsCopy: "Search and filter active roles, then save or apply when ready.",
    browseJobs: "Browse jobs",
    matchTitle: "CV Match Check",
    matchCopy:
      "See how well one version of your CV fits a job before you apply. Your report stays private.",
    openMatch: "Check my CV",
    securityTitle: "Account security",
    securityCopy:
      "Control your password, two-factor authentication, and sessions.",
    protected: "2FA enabled",
    recommended: "2FA recommended",
    nextKicker: "NEXT STEPS",
    nextTitle: "Make your profile stronger",
    done: "Complete",
    stepsLeft: (count: number) =>
      count === 0
        ? "All steps complete"
        : `${count} ${pluralize(count, "step left", "steps left")}`,
    steps: profileStepCopy("en"),
    workspaceSections: "Job, profile, and account management areas",
  };
}

function profileStepCopy(
  locale: "vi" | "en",
): Record<ProfileCompletionSection, { label: string; hint: string }> {
  if (locale === "vi") {
    return {
      avatar: { label: "Thêm ảnh hồ sơ", hint: "Tải lên ảnh hồ sơ rõ nét" },
      basics: {
        label: "Thêm tiêu đề và phần giới thiệu",
        hint: "Dùng tiêu đề từ 10 ký tự và phần giới thiệu từ 50 ký tự",
      },
      skills: { label: "Thêm kỹ năng nổi bật", hint: "Thêm ít nhất 3 kỹ năng" },
      experience: {
        label: "Thêm kinh nghiệm làm việc",
        hint: "Thêm ít nhất một kinh nghiệm",
      },
      education: {
        label: "Thêm học vấn",
        hint: "Thêm ít nhất một mục học vấn",
      },
      socialLinks: {
        label: "Thêm liên kết chuyên nghiệp",
        hint: "Thêm ít nhất một liên kết hồ sơ hoặc website",
      },
    };
  }

  return {
    avatar: {
      label: "Add a profile photo",
      hint: "Upload a clear profile photo",
    },
    basics: {
      label: "Add a headline and summary",
      hint: "Use a 10+ character headline and 50+ character summary",
    },
    skills: {
      label: "Add your strongest skills",
      hint: "Add at least 3 strong skills",
    },
    experience: {
      label: "Add work experience",
      hint: "Add at least one experience",
    },
    education: {
      label: "Add education",
      hint: "Add at least one education entry",
    },
    socialLinks: {
      label: "Add a professional link",
      hint: "Add at least one profile or website",
    },
  };
}
