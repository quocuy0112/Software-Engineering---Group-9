"use client";

import type { CSSProperties } from "react";
import { Camera, ArrowRight } from "lucide-react";
import type { CandidateProfileContract } from "@/shared/contracts/account/profile";
import { ProgressBar } from "@/frontend/components/ui/design-system";
import {
  getProfileCompletion,
  type ProfileCompletionSection,
} from "../lib/profile-completeness";

type ProfileCompletionLocale = "vi" | "en";

export { getProfileCompletion, type ProfileCompletionSection };

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
        <strong>{completion.percentage}%</strong>
        <span>{copy.progressLabel}</span>
        <ProgressBar percent={completion.percentage} label={copy.progress} />
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

function profileInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/u)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "SH"
  );
}

export function LegacyProfileIdentityHeader({
  profile,
  avatar,
  locale,
  accountName,
}: {
  profile: CandidateProfileContract;
  avatar: string | null | undefined;
  locale: ProfileCompletionLocale;
  accountName?: string;
}) {
  const copy = profileCompletionCopy(locale);
  const completion = getProfileCompletion(profile, avatar);
  const displayName = accountName?.trim() || "SmartHire candidate";
  const headline =
    profile.basics.headline?.trim() ||
    (locale === "vi"
      ? "Thêm tiêu đề nghề nghiệp để nhà tuyển dụng dễ nhận diện bạn."
      : "Add a professional headline so employers can recognize you.");

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

  const firstIncomplete =
    completion.items.find((item) => !item.complete) ?? completion.items[0];

  return (
    <section
      className="profile-completion profile-completion--identity"
      aria-labelledby="profile-completion-title"
    >
      <div className="profile-identity-main">
        <button
          type="button"
          className="profile-completion__avatar-button"
          aria-label={
            locale === "vi" ? "Chỉnh sửa ảnh đại diện" : "Edit profile photo"
          }
          onClick={() => focusSection("profile-avatar-section")}
        >
          <span
            className="profile-completion__avatar"
            role={avatar ? "img" : undefined}
            aria-label={avatar ? `${displayName} profile photo` : undefined}
            style={
              avatar
                ? ({
                    backgroundImage: `url(${JSON.stringify(avatar)})`,
                  } as CSSProperties)
                : undefined
            }
          >
            {!avatar ? profileInitials(displayName) : null}
          </span>
          <span className="profile-completion__camera" aria-hidden="true">
            <Camera />
          </span>
        </button>

        <div className="profile-identity-copy">
          <p className="profile-identity-kicker">
            <span aria-hidden="true" />
            {locale === "vi" ? "HỒ SƠ CỦA BẠN" : "YOUR PROFILE"}
          </p>
          <h2 id="profile-completion-title">{displayName}</h2>
          <p className="profile-identity-headline">{headline}</p>
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
                    {item.complete ? "✓" : "!"}
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
      </div>

      <div className="profile-identity-progress">
        <div className="profile-identity-progress-top">
          <strong>{completion.percentage}%</strong>
          <span>{copy.progressLabel}</span>
        </div>
        <ProgressBar
          className="profile-identity-progress-bar"
          percent={completion.percentage}
          label={copy.progress}
        />
        <button
          type="button"
          className="profile-completion-cta"
          onClick={() =>
            firstIncomplete ? focusSection(firstIncomplete.targetId) : undefined
          }
        >
          {locale === "vi" ? "Hoàn thiện hồ sơ" : "Complete profile"}
          <ArrowRight aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
