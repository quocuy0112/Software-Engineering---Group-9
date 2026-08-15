"use client";

import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { useRef, useState } from "react";
import { ExternalLink, Link2, Trash2 } from "lucide-react";
import type { IconType } from "react-icons";
import {
  FaFacebookF,
  FaGithub,
  FaInstagram,
  FaLinkedinIn,
} from "react-icons/fa";
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
import { ProfileCompactSection } from "./profile-compact-section";
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

type SocialPlatformId = (typeof socialPlatforms)[number]["id"];

const socialPlatformIcons: Record<SocialPlatformId, IconType> = {
  linkedin: FaLinkedinIn,
  github: FaGithub,
  facebook: FaFacebookF,
  instagram: FaInstagram,
};

function SocialPlatformIcon({ name }: { name: SocialPlatformId }) {
  const Icon = socialPlatformIcons[name];
  return (
    <Icon
      className="social-platform-logo"
      data-platform-logo={name}
      aria-hidden="true"
    />
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
  const editLabel =
    locale === "vi" ? "Chỉnh sửa liên kết" : "Edit professional links";
  const cancelLabel = locale === "vi" ? "Hủy" : "Cancel";
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
  const [quickLink, setQuickLink] = useState("");
  const [quickLinkError, setQuickLinkError] = useState("");
  const quickLinkInputRef = useRef<HTMLInputElement>(null);
  const hasSocialLinks = profile.socialLinks.length > 0;
  const [isEditing, setIsEditing] = useState(!hasSocialLinks);

  useServerFormReconciliation({ socialLinks: profile.socialLinks }, reset);
  useUnsavedChangesGuard(isDirty && isEditing);

  const quickCopy =
    locale === "vi"
      ? {
          label: "Liên kết hồ sơ hoặc website",
          placeholder: "Dán https://linkedin.com/in/ban",
          add: "Thêm liên kết",
          invalid: "Hãy nhập một liên kết http:// hoặc https:// hoàn chỉnh.",
          duplicate: "Liên kết này đã có trong danh sách.",
        }
      : {
          label: "Profile or website link",
          placeholder: "Paste https://linkedin.com/in/your-name",
          add: "Add link",
          invalid: "Enter a complete http:// or https:// link.",
          duplicate: "This link is already in your list.",
        };

  if (!isEditing) {
    return (
      <ProfileCompactSection
        sectionId="profile-social-section"
        titleId="profile-social-title"
        kicker={copy.kicker}
        title={copy.title}
        mark="IN"
        count={
          locale === "vi"
            ? `${profile.socialLinks.length} liên kết`
            : `${profile.socialLinks.length} ${
                profile.socialLinks.length === 1 ? "link" : "links"
              }`
        }
        feedback={<ProfileSaveFeedback feedback={feedback} />}
        content={
          hasSocialLinks ? (
            <div
              className="profile-social-link-list"
              aria-label="Saved professional links"
            >
              {profile.socialLinks.map((link, index) => {
                const platform = platformFor(link.url);
                const platformName = platform?.name ?? copy.generic;

                return (
                  <a
                    aria-label={link.url}
                    className="profile-social-link"
                    href={link.url}
                    key={link.id || `${link.url}-${index}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span
                      className="social-platform-mark"
                      data-platform={platform?.id ?? "website"}
                      aria-hidden="true"
                    >
                      {platform ? (
                        <SocialPlatformIcon name={platform.id} />
                      ) : (
                        <Link2 aria-hidden="true" />
                      )}
                    </span>
                    <span className="profile-social-link-copy">
                      <strong>{platformName}</strong>
                      <span>{link.url}</span>
                    </span>
                    <ExternalLink aria-hidden="true" />
                  </a>
                );
              })}
            </div>
          ) : (
            <div className="profile-compact-empty-text">
              <strong>No professional links added yet.</strong>
              <span>Connect the profiles you want employers to see.</span>
            </div>
          )
        }
        action={
          <button
            className={
              hasSocialLinks
                ? "profile-section-edit-button"
                : "profile-section-secondary-button"
            }
            type="button"
            onClick={() => setIsEditing(true)}
          >
            {hasSocialLinks ? editLabel : copy.addWebsite}
          </button>
        }
      />
    );
  }

  function addQuickLink() {
    const url = quickLink.trim();
    if (!isCompleteSocialUrl(url)) {
      setQuickLinkError(quickCopy.invalid);
      quickLinkInputRef.current?.focus();
      return;
    }
    if (
      links.some(
        (link) =>
          link.url.trim().toLocaleLowerCase() === url.toLocaleLowerCase(),
      )
    ) {
      setQuickLinkError(quickCopy.duplicate);
      quickLinkInputRef.current?.focus();
      return;
    }

    append({ url });
    setQuickLink("");
    setQuickLinkError("");
  }

  function applyPlatformTemplate(prefix: string) {
    setQuickLink(prefix);
    setQuickLinkError("");
    quickLinkInputRef.current?.focus();
  }

  return (
    <form
      id="profile-social-section"
      className="candidate-section candidate-section--editing"
      aria-labelledby="profile-social-title"
      onSubmit={handleSubmit(async ({ socialLinks }) => {
        const saved = await onSave({
          section: "socialLinks",
          socialLinks: socialLinks.map(({ id, url }) =>
            id ? { id, url } : { url },
          ),
        });
        if (saved) setIsEditing(false);
      })}
    >
      <div className="professional-profile-section-heading">
        <div>
          <p className="panel-kicker">{copy.kicker}</p>
          <h2 id="profile-social-title">{copy.title}</h2>
          <UnsavedChangesIndicator dirty={isDirty} />
        </div>
        <div className="profile-section-action-group">
          <button type="submit" disabled={saving}>
            {saving ? copy.saving : copy.save}
          </button>
          {hasSocialLinks ? (
            <button
              className="profile-section-secondary-button"
              type="button"
              onClick={() => {
                reset({ socialLinks: profile.socialLinks });
                setQuickLink("");
                setQuickLinkError("");
                setIsEditing(false);
              }}
            >
              {cancelLabel}
            </button>
          ) : null}
        </div>
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
        <div className="social-link-quick-add">
          <label htmlFor="profile-social-quick-add">{quickCopy.label}</label>
          <div>
            <input
              ref={quickLinkInputRef}
              id="profile-social-quick-add"
              type="url"
              maxLength={2_048}
              placeholder={quickCopy.placeholder}
              value={quickLink}
              aria-invalid={Boolean(quickLinkError)}
              aria-describedby={
                quickLinkError ? "profile-social-quick-add-error" : undefined
              }
              onChange={(event) => {
                setQuickLink(event.target.value);
                setQuickLinkError("");
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                addQuickLink();
              }}
            />
            <button
              type="button"
              disabled={fields.length >= 10}
              onClick={addQuickLink}
            >
              {quickCopy.add}
            </button>
          </div>
          {quickLinkError ? (
            <p id="profile-social-quick-add-error" role="alert">
              {quickLinkError}
            </p>
          ) : null}
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
                      : `Use ${platform.name} template`
                }
                disabled={fields.length >= 10 || added}
                onClick={() => applyPlatformTemplate(platform.prefix)}
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
                {platform ? (
                  <span className="social-link-row-platform">
                    <span
                      className="social-platform-mark"
                      data-platform={platform.id}
                      aria-hidden="true"
                    >
                      <SocialPlatformIcon name={platform.id} />
                    </span>
                    {platform.name} URL
                  </span>
                ) : (
                  `${copy.generic} ${index + 1}`
                )}
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
                    {copy.open} <ExternalLink aria-hidden="true" />
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
                  className="social-link-remove"
                >
                  <Trash2 aria-hidden="true" />
                  <span>{copy.remove}</span>
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
          onClick={() => quickLinkInputRef.current?.focus()}
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
