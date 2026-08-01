"use client";

import { useFieldArray, useForm, useWatch } from "react-hook-form";
import type { CandidateProfileContract } from "@/shared/contracts/account/profile";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import type { ProfileSectionDraft } from "../client/use-profile-editor";
import { useServerFormReconciliation } from "../client/use-server-form-reconciliation";
import {
  UnsavedChangesIndicator,
  useUnsavedChangesGuard,
} from "../client/unsaved-changes";

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

function SocialPlatformIcon({
  name,
}: {
  name: (typeof socialPlatforms)[number]["id"];
}) {
  if (name === "instagram") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.7" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  const path = {
    linkedin:
      "M4 9h3v10H4Zm1.5-5A1.7 1.7 0 1 1 5.5 7.4 1.7 1.7 0 0 1 5.5 4ZM10 9h3v1.5c1.1-1.8 6-2.5 6 3.5v5h-3v-4.5c0-2.7-3-2.4-3 0V19h-3Z",
    github:
      "M12 3.5a8.5 8.5 0 0 0-2.7 16.6c.4.1.5-.2.5-.4v-1.6c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.2 1.9.9 2.3.7.1-.5.3-.9.6-1.1-1.8-.2-3.6-.9-3.6-4a3.1 3.1 0 0 1 .8-2.2 2.9 2.9 0 0 1 .1-2.2s.7-.2 2.3.8a8 8 0 0 1 4.2 0c1.6-1 2.3-.8 2.3-.8a2.9 2.9 0 0 1 .1 2.2 3.1 3.1 0 0 1 .8 2.2c0 3.1-1.9 3.8-3.6 4 .3.2.6.7.6 1.4v2.2c0 .2.1.5.5.4A8.5 8.5 0 0 0 12 3.5Z",
    facebook:
      "M14 8h3V4.3c-.5-.1-2-.3-3.4-.3C10.8 4 9 5.7 9 8.8V12H6v4h3v7h4v-7h3.2l.5-4H13V9.2c0-.8.2-1.2 1-1.2Z",
  }[name];
  return (
    <svg viewBox="0 0 24 24">
      <path d={path} />
    </svg>
  );
}

export function ProfileSocialLinksForm({
  profile,
  saving,
  onSave,
}: {
  profile: CandidateProfileContract;
  saving: boolean;
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
                {...register(`socialLinks.${index}.url`, {
                  validate: (url) =>
                    isCompleteSocialUrl(url) || copy.incomplete,
                })}
              />
              {errors.socialLinks?.[index]?.url?.message ? (
                <p className="profile-field-error social-link-error">
                  {errors.socialLinks[index]?.url?.message}
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
