"use client";

import { useFieldArray, useForm, useWatch } from "react-hook-form";
import type { CandidateProfileContract } from "@/shared/contracts/account/profile";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import type {
  ProfileEditorFeedback,
  ProfileSectionDraft,
} from "../client/use-profile-editor";
import { useServerFormReconciliation } from "../client/use-server-form-reconciliation";
import {
  UnsavedChangesIndicator,
  useUnsavedChangesGuard,
} from "../client/unsaved-changes";
import { ProfileSaveFeedback } from "./profile-save-feedback";

type SocialValues = {
  socialLinks: Array<{ id?: string; url: string }>;
};

const socialPlatforms = [
  {
    id: "linkedin",
    name: "LinkedIn",
    domain: "linkedin.com",
    prefix: "https://www.linkedin.com/in/",
  },
  {
    id: "github",
    name: "GitHub",
    domain: "github.com",
    prefix: "https://github.com/",
  },
  {
    id: "facebook",
    name: "Facebook",
    domain: "facebook.com",
    prefix: "https://www.facebook.com/",
  },
  {
    id: "instagram",
    name: "Instagram",
    domain: "instagram.com",
    prefix: "https://www.instagram.com/",
  },
] as const;

function parsedSocialUrl(value = "") {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./u, "");
    return { url, host, path: url.pathname.replace(/\/+$/u, "") };
  } catch {
    return null;
  }
}

function platformFor(value = "") {
  const parsed = parsedSocialUrl(value);
  if (!parsed) return undefined;
  return socialPlatforms.find(
    (platform) =>
      parsed.host === platform.domain ||
      parsed.host.endsWith(`.${platform.domain}`),
  );
}

function isCompleteSocialUrl(value: string) {
  const parsed = parsedSocialUrl(value);
  if (
    !parsed ||
    !["http:", "https:"].includes(parsed.url.protocol) ||
    parsed.url.username ||
    parsed.url.password
  ) {
    return false;
  }
  if (["github.com", "facebook.com", "instagram.com"].includes(parsed.host)) {
    return parsed.path.length > 0;
  }
  if (parsed.host === "linkedin.com") {
    return !["", "/in"].includes(parsed.path);
  }
  return true;
}

const socialPlatformIconPaths = {
  linkedin:
    "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.119 20.452H3.555V9h3.564v11.452z",
  github:
    "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577v-1.6c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.084-.729.084-.729 1.205.084 1.838 1.237 1.838 1.237 1.07 1.835 2.809 1.305 3.495.998.108-.776.418-1.305.762-1.605-2.665-.3-5.466-1.332-5.466-5.931 0-1.31.465-2.381 1.235-3.221-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.046.138 3.006.404 2.292-1.552 3.297-1.23 3.297-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.911 1.23 3.221 0 4.61-2.805 5.626-5.475 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
  facebook:
    "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  instagram:
    "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.265-.057 1.645-.069 4.849-.069zm0-2.163C8.74 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.74 0 12s.014 3.667.072 4.947c.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.74 24 12 24s3.667-.014 4.947-.072c4.354-.2 6.782-2.618 6.979-6.98.058-1.28.072-1.687.072-4.947s-.014-3.667-.072-4.947c-.196-4.354-2.617-6.78-6.979-6.98C15.667.014 15.26 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z",
} as const;

function SocialPlatformIcon({
  name,
}: {
  name: (typeof socialPlatforms)[number]["id"];
}) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={socialPlatformIconPaths[name]} />
    </svg>
  );
}

export function ProfileSocialLinksForm({
  profile,
  saving,
  feedback,
  onSave,
}: {
  profile: CandidateProfileContract;
  saving: boolean;
  feedback: ProfileEditorFeedback | null;
  onSave: (draft: ProfileSectionDraft) => Promise<boolean>;
}) {
  const locale = useWorkspaceLocale();
  const copy =
    locale === "vi"
      ? {
          kicker: "HIỆN DIỆN TRỰC TUYẾN",
          title: "Liên kết nghề nghiệp",
          save: "Lưu liên kết",
          saving: "Đang lưu liên kết…",
          pickerTitle: "Kết nối hồ sơ mạng xã hội",
          pickerCopy:
            "Chọn nền tảng, sau đó hoàn thiện địa chỉ hồ sơ được chuẩn bị sẵn.",
          added: "Đã thêm",
          addProfile: "Thêm hồ sơ",
          hint: "Dùng địa chỉ http:// hoặc https:// đầy đủ và không chứa thông tin đăng nhập.",
          empty: "Bạn chưa thêm liên kết nghề nghiệp nào.",
          generic: "Liên kết",
          incomplete: "Hãy nhập đầy đủ tên tài khoản hoặc đường dẫn hồ sơ.",
          open: "Mở thử",
          moveUp: "Di chuyển lên",
          moveDown: "Di chuyển xuống",
          remove: "Xóa",
          addWebsite: "Thêm website khác",
          count: "liên kết",
        }
      : {
          kicker: "AROUND THE WEB",
          title: "Professional links",
          save: "Save social links",
          saving: "Saving social links…",
          pickerTitle: "Connect your social profiles",
          pickerCopy:
            "Choose a platform, then complete the profile address we prepare for you.",
          added: "Added",
          addProfile: "Add profile",
          hint: "Use a complete http:// or https:// address without embedded credentials.",
          empty: "No professional links added yet.",
          generic: "Social link",
          incomplete: "Complete the username or profile path before saving.",
          open: "Open link",
          moveUp: "Move up",
          moveDown: "Move down",
          remove: "Remove",
          addWebsite: "Add another website",
          count: "links",
        };
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<SocialValues>({
    defaultValues: { socialLinks: profile.socialLinks },
  });
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "socialLinks",
    keyName: "fieldKey",
  });
  const links = useWatch({ control, name: "socialLinks" }) ?? [];

  useServerFormReconciliation({ socialLinks: profile.socialLinks }, reset);
  useUnsavedChangesGuard(isDirty);

  return (
    <form
      id="profile-social-section"
      className="professional-profile-section"
      aria-labelledby="profile-social-title"
      onSubmit={handleSubmit(async ({ socialLinks }) => {
        await onSave({
          section: "socialLinks",
          socialLinks: socialLinks.map(({ id, url }) =>
            id ? { id, url } : { url },
          ),
        });
      })}
    >
      <div className="professional-profile-section-heading">
        <div>
          <p className="panel-kicker">{copy.kicker}</p>
          <h2 id="profile-social-title">{copy.title}</h2>
          <UnsavedChangesIndicator dirty={isDirty} />
        </div>
        <button type="submit" disabled={saving}>
          {saving ? copy.saving : copy.save}
        </button>
      </div>
      <ProfileSaveFeedback feedback={feedback} />
      <section
        className="social-link-picker"
        aria-labelledby="social-picker-title"
      >
        <div className="social-link-picker-copy">
          <h3 id="social-picker-title">{copy.pickerTitle}</h3>
          <p>{copy.pickerCopy}</p>
        </div>
        <div className="social-platform-grid">
          {socialPlatforms.map((platform) => {
            const added = links.some(
              ({ url }) => platformFor(url)?.id === platform.id,
            );
            return (
              <button
                key={platform.id}
                type="button"
                data-platform={platform.id}
                aria-label={
                  locale === "vi"
                    ? added
                      ? `${platform.name} đã thêm`
                      : `Thêm hồ sơ ${platform.name}`
                    : added
                      ? `${platform.name} profile added`
                      : `Add ${platform.name} profile`
                }
                disabled={fields.length >= 10 || added}
                onClick={() => append({ url: platform.prefix })}
              >
                <span className="social-platform-mark" aria-hidden="true">
                  <SocialPlatformIcon name={platform.id} />
                </span>
                <span>
                  <strong>{platform.name}</strong>
                  <small>{added ? copy.added : copy.addProfile}</small>
                </span>
              </button>
            );
          })}
        </div>
      </section>
      <p className="profile-field-hint social-links-hint">{copy.hint}</p>
      {fields.length === 0 ? <p>{copy.empty}</p> : null}
      <ol className="professional-profile-list">
        {fields.map((field, index) => {
          const value = links[index]?.url ?? "";
          const platform = platformFor(value);
          const serverError =
            feedback?.fieldErrors?.[`socialLinks.${index}.url`]?.[0];
          const linkError =
            errors.socialLinks?.[index]?.url?.message ?? serverError;
          return (
            <li
              key={field.fieldKey}
              className="professional-profile-list-row social-link-row"
            >
              <input type="hidden" {...register(`socialLinks.${index}.id`)} />
              <label htmlFor={`profile-social-${index}`}>
                {platform
                  ? `${platform.name} URL`
                  : `${copy.generic} ${index + 1}`}
              </label>
              <input
                id={`profile-social-${index}`}
                type="url"
                maxLength={2_048}
                placeholder="https://example.com/your-profile"
                data-field-path={`socialLinks.${index}.url`}
                aria-invalid={Boolean(linkError)}
                aria-describedby={
                  linkError ? `profile-social-${index}-error` : undefined
                }
                {...register(`socialLinks.${index}.url`, {
                  validate: (url) =>
                    isCompleteSocialUrl(url) || copy.incomplete,
                })}
              />
              {linkError ? (
                <p
                  id={`profile-social-${index}-error`}
                  className="profile-field-error social-link-error"
                >
                  {linkError}
                </p>
              ) : null}
              <div className="professional-profile-row-actions">
                {isCompleteSocialUrl(value) ? (
                  <a
                    className="social-link-preview"
                    href={value}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {copy.open} <span aria-hidden="true">↗</span>
                  </a>
                ) : null}
                <button
                  type="button"
                  aria-label={
                    locale === "vi"
                      ? `Di chuyển liên kết ${index + 1} lên`
                      : `Move social link ${index + 1} up`
                  }
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  {copy.moveUp}
                </button>
                <button
                  type="button"
                  aria-label={
                    locale === "vi"
                      ? `Di chuyển liên kết ${index + 1} xuống`
                      : `Move social link ${index + 1} down`
                  }
                  disabled={index === fields.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  {copy.moveDown}
                </button>
                <button
                  type="button"
                  aria-label={
                    locale === "vi"
                      ? `Xóa liên kết ${index + 1}`
                      : `Remove social link ${index + 1}`
                  }
                  onClick={() => remove(index)}
                >
                  {copy.remove}
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="professional-profile-add-row">
        <button
          type="button"
          aria-label={
            locale === "vi" ? "Thêm liên kết xã hội" : "Add social link"
          }
          disabled={fields.length >= 10}
          onClick={() => append({ url: "" })}
        >
          {copy.addWebsite}
        </button>
        <p className="profile-field-hint">
          {fields.length} / 10 {copy.count}
        </p>
      </div>
    </form>
  );
}
