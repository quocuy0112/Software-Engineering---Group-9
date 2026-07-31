"use client";

import { useFieldArray, useForm } from "react-hook-form";
import type { CandidateProfileContract } from "@/shared/contracts/account/profile";
import type { ProfileSectionDraft } from "../client/use-profile-editor";
import { useServerFormReconciliation } from "../client/use-server-form-reconciliation";

type SocialValues = {
  socialLinks: Array<{ id?: string; url: string }>;
};

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
      <p className="profile-field-hint">
        Use a complete http:// or https:// address without embedded credentials.
      </p>
      {fields.length === 0 ? <p>No professional links added yet.</p> : null}
      <ol className="professional-profile-list">
        {fields.map((field, index) => (
          <li key={field.fieldKey} className="professional-profile-list-row">
            <input type="hidden" {...register(`socialLinks.${index}.id`)} />
            <label htmlFor={`profile-social-${index}`}>
              Social link {index + 1}
            </label>
            <input
              id={`profile-social-${index}`}
              type="url"
              maxLength={2_048}
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
        ))}
      </ol>
      <button
        type="button"
        disabled={fields.length >= 10}
        onClick={() => append({ url: "" })}
      >
        Add social link
      </button>
      <p className="profile-field-hint">{fields.length} of 10 links</p>
    </form>
  );
}
