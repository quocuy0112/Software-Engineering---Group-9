"use client";

import type { CSSProperties } from "react";
import { ArrowRight, Camera } from "lucide-react";
import type { CandidateProfileContract } from "@/shared/contracts/account/profile";
import { ProgressBar } from "@/frontend/components/ui/design-system";
import { Button } from "@/frontend/components/ui/button";
import { getProfileCompletion } from "./profile-completion-header";

type Locale = "vi" | "en";

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/u)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "SH"
  );
}

function copyFor(locale: Locale) {
  return locale === "vi"
    ? {
        progress: "Mức độ hoàn thiện hồ sơ",
        progressLabel: "HOÀN THÀNH",
        editAvatar: "Chỉnh sửa ảnh đại diện",
        complete: "Hoàn thiện hồ sơ",
        completeTag: "Hồ sơ đã hoàn thiện",
        missing: (label: string) => `Còn thiếu: ${label}`,
        avatar: "Ảnh đại diện",
        basics: "tóm tắt",
        skills: "kỹ năng",
        experience: "kinh nghiệm",
        education: "học vấn",
        socialLinks: "liên kết",
        fallbackHeadline:
          "Bổ sung tiêu đề nghề nghiệp để nhà tuyển dụng dễ nhận diện bạn.",
      }
    : {
        progress: "Profile completion",
        progressLabel: "COMPLETE",
        editAvatar: "Edit profile photo",
        complete: "Complete profile",
        completeTag: "Profile complete",
        missing: (label: string) => `Missing: ${label}`,
        avatar: "profile photo",
        basics: "summary",
        skills: "skills",
        experience: "experience",
        education: "education",
        socialLinks: "links",
        fallbackHeadline:
          "Add a professional headline so employers can recognize you.",
      };
}

export function ProfileIdentityHeader({
  profile,
  avatar,
  locale,
  accountName,
  onEditAvatar,
}: {
  profile: CandidateProfileContract;
  avatar: string | null | undefined;
  locale: Locale;
  accountName?: string;
  onEditAvatar?: () => void;
}) {
  const copy = copyFor(locale);
  const completion = getProfileCompletion(profile, avatar);
  const displayName = accountName?.trim() || "SmartHire candidate";
  const headline = profile.basics.headline?.trim() || copy.fallbackHeadline;
  const labels = {
    avatar: copy.avatar,
    basics: copy.basics,
    skills: copy.skills,
    experience: copy.experience,
    education: copy.education,
    socialLinks: copy.socialLinks,
  };
  const incomplete = completion.items.filter((item) => !item.complete);
  const firstIncomplete = incomplete[0];

  function focusItem(targetId: string) {
    if (targetId === "profile-avatar-section") {
      onEditAvatar?.();
      return;
    }

    const target = document.getElementById(targetId);
    if (!target) return;
    const reducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    target.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
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
      reducedMotion ? 0 : 220,
    );
  }

  return (
    <section
      className="candidate-identity"
      aria-labelledby="candidate-identity-title"
    >
      <div className="candidate-identity__main">
        <button
          type="button"
          className="candidate-identity__avatar-button"
          aria-label={copy.editAvatar}
          onClick={onEditAvatar}
        >
          <span
            className="candidate-identity__avatar"
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
            {avatar ? null : initials(displayName)}
          </span>
          <span className="candidate-identity__camera" aria-hidden="true">
            <Camera />
          </span>
        </button>

        <div className="candidate-identity__copy">
          <h2 id="candidate-identity-title">{displayName}</h2>
          <p>{headline}</p>
          <div
            className="candidate-identity__missing"
            aria-label={copy.progress}
          >
            {incomplete.length ? (
              incomplete.slice(0, 3).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => focusItem(item.targetId)}
                >
                  {copy.missing(labels[item.key])}
                </button>
              ))
            ) : (
              <span>{copy.completeTag}</span>
            )}
          </div>
        </div>
      </div>

      <div className="candidate-identity__progress">
        <div className="candidate-identity__progress-copy">
          <strong>{completion.percentage}%</strong>
          <span>{copy.progressLabel}</span>
        </div>
        <ProgressBar percent={completion.percentage} label={copy.progress} />
        <Button
          fullWidth
          className="candidate-identity__cta"
          onClick={() => {
            if (firstIncomplete) focusItem(firstIncomplete.targetId);
          }}
        >
          {copy.complete}
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}
