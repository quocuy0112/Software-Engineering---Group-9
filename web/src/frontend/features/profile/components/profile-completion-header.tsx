"use client";

import type { CSSProperties } from "react";
import type { CandidateProfileContract } from "@/shared/contracts/account/profile";

type ProfileCompletionLocale = "vi" | "en";

export type ProfileCompletionSection =
  | "avatar"
  | "basics"
  | "skills"
  | "experience"
  | "education"
  | "socialLinks";

type CompletionItem = {
  key: ProfileCompletionSection;
  targetId: string;
  complete: boolean;
};

const circumference = 2 * Math.PI * 45;

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function hasProfessionalLink(value: string) {
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function getProfileCompletion(
  profile: CandidateProfileContract,
  avatar: string | null | undefined,
) {
  const items: CompletionItem[] = [
    {
      key: "avatar",
      targetId: "profile-avatar-section",
      complete: Boolean(avatar),
    },
    {
      key: "basics",
      targetId: "profile-basics-section",
      complete:
        hasText(profile.basics.headline) &&
        [
          profile.basics.summary,
          profile.basics.phone,
          profile.basics.location,
        ].some(hasText),
    },
    {
      key: "skills",
      targetId: "profile-skills-section",
      complete: profile.skills.some((skill) => hasText(skill.label)),
    },
    {
      key: "experience",
      targetId: "profile-experience-section",
      complete: profile.experience.some(
        (entry) => hasText(entry.title) && hasText(entry.company),
      ),
    },
    {
      key: "education",
      targetId: "profile-education-section",
      complete: profile.education.some(
        (entry) => hasText(entry.institution) && hasText(entry.degree),
      ),
    },
    {
      key: "socialLinks",
      targetId: "profile-social-section",
      complete: profile.socialLinks.some((link) =>
        hasProfessionalLink(link.url),
      ),
    },
  ];

  const completed = items.filter((item) => item.complete).length;
  return {
    items,
    completed,
    percentage: Math.round((completed / items.length) * 100),
  };
}

function profileCompletionCopy(locale: ProfileCompletionLocale) {
  return locale === "vi"
    ? {
        title: "Hoàn thiện hồ sơ để nhận gợi ý việc làm sát hơn",
        description:
          "Bổ sung thông tin nghề nghiệp để cải thiện gợi ý việc làm và giúp nhà tuyển dụng hiểu rõ hơn về bạn.",
        complete: "Đã hoàn thiện",
        incomplete: "Chưa hoàn thiện",
        progress: "Mức độ hoàn thiện hồ sơ",
        progressLabel: "HOÀN THIỆN",
        completedCount: (completed: number, total: number) =>
          `${completed}/${total} hạng mục`,
        checklist: "Các hạng mục hồ sơ",
        checklistHint: "Chọn một mục để bổ sung hoặc cập nhật.",
        avatar: "Ảnh đại diện",
        basics: "Thông tin cơ bản",
        skills: "Kỹ năng",
        experience: "Kinh nghiệm",
        education: "Học vấn",
        socialLinks: "Liên kết nghề nghiệp",
      }
    : {
        title: "Complete your profile for better job recommendations",
        description:
          "Add professional information to improve job recommendations and help recruiters understand your profile.",
        complete: "Complete",
        incomplete: "Incomplete",
        progress: "Profile completion",
        progressLabel: "COMPLETE",
        completedCount: (completed: number, total: number) =>
          `${completed}/${total} sections`,
        checklist: "Profile sections",
        checklistHint: "Choose a section to add or update its details.",
        avatar: "Profile photo",
        basics: "Basic information",
        skills: "Skills",
        experience: "Experience",
        education: "Education",
        socialLinks: "Professional links",
      };
}

export function ProfileCompletionHeader({
  profile,
  avatar,
  locale,
}: {
  profile: CandidateProfileContract;
  avatar: string | null | undefined;
  locale: ProfileCompletionLocale;
}) {
  const copy = profileCompletionCopy(locale);
  const completion = getProfileCompletion(profile, avatar);
  const ringStyle = {
    "--profile-completion-circumference": String(circumference),
    "--profile-completion-offset": String(
      circumference * (1 - completion.percentage / 100),
    ),
  } as CSSProperties;

  function focusSection(targetId: string) {
    const target = document.getElementById(targetId);
    if (!target) return;

    const reduceMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    target.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });

    window.setTimeout(
      () => {
        target
          .querySelector<HTMLElement>(
            "input, textarea, button, select, a[href]",
          )
          ?.focus({ preventScroll: true });
      },
      reduceMotion ? 0 : 260,
    );
  }

  return (
    <section
      className="profile-completion"
      aria-labelledby="profile-completion-title"
    >
      <div className="profile-completion__visual">
        <div
          className="profile-completion__ring"
          role="progressbar"
          aria-label={copy.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={completion.percentage}
          style={ringStyle}
        >
          <svg aria-hidden="true" viewBox="0 0 104 104">
            <defs>
              <linearGradient
                id="profile-completion-gradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="var(--sh-color-brand-primary)" />
                <stop
                  offset="100%"
                  stopColor="var(--sh-color-brand-primary-hover)"
                />
              </linearGradient>
            </defs>
            <circle
              className="profile-completion__ring-track"
              cx="52"
              cy="52"
              r="45"
            />
            <circle
              className="profile-completion__ring-value"
              cx="52"
              cy="52"
              r="45"
            />
          </svg>
          <div className="profile-completion__ring-copy" aria-hidden="true">
            <strong>{completion.percentage}%</strong>
            <span>{copy.progressLabel}</span>
          </div>
        </div>
        <p aria-hidden="true">
          {copy.completedCount(completion.completed, completion.items.length)}
        </p>
      </div>

      <div className="profile-completion__content">
        <h2 id="profile-completion-title">{copy.title}</h2>
        <p>{copy.description}</p>
        <div className="profile-completion__checklist-heading">
          <strong>{copy.checklist}</strong>
          <span>{copy.checklistHint}</span>
        </div>
        <div className="profile-completion__chips" aria-label={copy.progress}>
          {completion.items.map((item) => {
            const label = copy[item.key];
            return (
              <button
                key={item.key}
                type="button"
                className={item.complete ? "is-complete" : "is-incomplete"}
                aria-label={`${label}: ${
                  item.complete ? copy.complete : copy.incomplete
                }`}
                onClick={() => focusSection(item.targetId)}
              >
                <span
                  className="profile-completion__chip-indicator"
                  aria-hidden="true"
                >
                  {item.complete ? "✓" : "○"}
                </span>
                <span className="profile-completion__chip-copy">
                  <strong>{label}</strong>
                  <small>
                    {item.complete ? copy.complete : copy.incomplete}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
