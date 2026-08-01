"use client";

import { useFieldArray, useForm, useWatch } from "react-hook-form";
import type { CandidateProfileContract } from "@/shared/contracts/account/profile";
import type { ProfileSectionDraft } from "../client/use-profile-editor";
import { useServerFormReconciliation } from "../client/use-server-form-reconciliation";

type SocialValues = {
  socialLinks: Array<{ id?: string; url: string }>;
};

const socialPlatforms = [
  {
    id: "linkedin",
    name: "LinkedIn",
    domain: "linkedin.com",
    prefix: "https://www.linkedin.com/in/",
    mark: "in",
  },
  {
    id: "github",
    name: "GitHub",
    domain: "github.com",
    prefix: "https://github.com/",
    mark: "GH",
  },
  {
    id: "facebook",
    name: "Facebook",
    domain: "facebook.com",
    prefix: "https://www.facebook.com/",
    mark: "f",
  },
  {
    id: "instagram",
    name: "Instagram",
    domain: "instagram.com",
    prefix: "https://www.instagram.com/",
    mark: "◎",
  },
] as const;

function platformFor(url = "") {
  return socialPlatforms.find((platform) => url.includes(platform.domain));
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
  const { control, register, handleSubmit, reset } = useForm<SocialValues>({
    defaultValues: { socialLinks: profile.socialLinks },
  });
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "socialLinks",
    keyName: "fieldKey",
  });
  const links = useWatch({ control, name: "socialLinks" }) ?? [];

  useServerFormReconciliation({ socialLinks: profile.socialLinks }, reset);

  return (
    <form
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
          <p className="panel-kicker">AROUND THE WEB</p>
          <h2 id="profile-social-title">Professional links</h2>
        </div>
        <button type="submit" disabled={saving}>
          {saving ? "Saving social links…" : "Save social links"}
        </button>
      </div>
      <section
        className="social-link-picker"
        aria-labelledby="social-picker-title"
      >
        <div className="social-link-picker-copy">
          <h3 id="social-picker-title">Connect your social profiles</h3>
          <p>
            Choose a platform, then complete the profile address we prepare for
            you.
          </p>
        </div>
        <div className="social-platform-grid">
          {socialPlatforms.map((platform) => {
            const added = links.some(({ url }) =>
              url.includes(platform.domain),
            );
            return (
              <button
                key={platform.id}
                type="button"
                data-platform={platform.id}
                aria-label={
                  added
                    ? `${platform.name} profile added`
                    : `Add ${platform.name} profile`
                }
                disabled={fields.length >= 10 || added}
                onClick={() => append({ url: platform.prefix })}
              >
                <span className="social-platform-mark" aria-hidden="true">
                  {platform.mark}
                </span>
                <span>
                  <strong>{platform.name}</strong>
                  <small>{added ? "Added" : "Add profile"}</small>
                </span>
              </button>
            );
          })}
        </div>
      </section>
      <p className="profile-field-hint social-links-hint">
        Use a complete http:// or https:// address without embedded credentials.
      </p>
      {fields.length === 0 ? <p>No professional links added yet.</p> : null}
      <ol className="professional-profile-list">
        {fields.map((field, index) => {
          const platform = platformFor(links[index]?.url);
          return (
            <li
              key={field.fieldKey}
              className="professional-profile-list-row social-link-row"
            >
              <input type="hidden" {...register(`socialLinks.${index}.id`)} />
              <label htmlFor={`profile-social-${index}`}>
                {platform ? `${platform.name} URL` : `Social link ${index + 1}`}
              </label>
              <input
                id={`profile-social-${index}`}
                type="url"
                maxLength={2_048}
                placeholder="https://example.com/your-profile"
                {...register(`socialLinks.${index}.url`)}
              />
              <div className="professional-profile-row-actions">
                <button
                  type="button"
                  aria-label={`Move social link ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  Move up
                </button>
                <button
                  type="button"
                  aria-label={`Move social link ${index + 1} down`}
                  disabled={index === fields.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  Move down
                </button>
                <button
                  type="button"
                  aria-label={`Remove social link ${index + 1}`}
                  onClick={() => remove(index)}
                >
                  Remove
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="professional-profile-add-row">
        <button
          type="button"
          aria-label="Add social link"
          disabled={fields.length >= 10}
          onClick={() => append({ url: "" })}
        >
          Add another website
        </button>
        <p className="profile-field-hint">{fields.length} of 10 links</p>
      </div>
    </form>
  );
}
