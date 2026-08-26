"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { LockKeyhole, UserRound } from "lucide-react";
import type { CandidateProfileContract } from "@/shared/contracts/account/profile";
import { Panel } from "@/frontend/components/ui/design-system";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import { useServerFormReconciliation } from "../client/use-server-form-reconciliation";
import {
  UnsavedChangesIndicator,
  useUnsavedChangesGuard,
} from "../client/unsaved-changes";
import type {
  ProfileEditorFeedback,
  ProfileSectionDraft,
} from "../client/use-profile-editor";
import { ProfileSaveFeedback } from "./profile-save-feedback";
import { profileAboutCopy } from "../i18n/profile-about-copy";

type AboutValues = {
  dateOfBirth: string;
  preferredName: string;
  interests: string;
  bio: string;
};

const emptyAbout: NonNullable<CandidateProfileContract["about"]> = {
  dateOfBirth: null,
  preferredName: null,
  interests: null,
  bio: null,
};

const valuesFrom = (
  about: CandidateProfileContract["about"] | undefined,
): AboutValues => ({
  dateOfBirth: about?.dateOfBirth ?? "",
  preferredName: about?.preferredName ?? "",
  interests: about?.interests ?? "",
  bio: about?.bio ?? "",
});

export function ProfileAboutForm({
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
  const copy = profileAboutCopy(locale);

  const about = profile.about ?? emptyAbout;
  const initialValues = valuesFrom(about);
  const hasAbout = Object.values(initialValues).some((value) => value.trim());
  const [isEditing, setIsEditing] = useState(!hasAbout);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<AboutValues>({ defaultValues: initialValues });

  useServerFormReconciliation(initialValues, reset);
  useUnsavedChangesGuard(isDirty && isEditing);

  const fieldError = (path: string) => feedback?.fieldErrors?.[path]?.[0];
  const fieldDescribedBy = (path: string, hintId?: string) => {
    const errorId = fieldError(path) ? `${path.replaceAll(".", "-")}-error` : null;
    return [hintId, errorId].filter(Boolean).join(" ") || undefined;
  };

  const renderValue = (value: string, emptyLabel = copy.notAdded) =>
    value.trim() ? value : emptyLabel;

  if (!isEditing) {
    return (
      <Panel
        as="article"
        className="profile-about-card"
        eyebrow={
          <>
            <span className="profile-about-eyebrow-mark" aria-hidden="true">
              <UserRound />
            </span>
            {copy.kicker}
          </>
        }
        title={copy.title}
        titleId="profile-about-title"
        rightSlot={
          <button
            type="button"
            className="profile-section-edit-button"
            onClick={() => setIsEditing(true)}
          >
            {copy.edit}
          </button>
        }
      >
        <p className="profile-about-description">{copy.description}</p>
        <div className="profile-about-privacy" role="note">
          <LockKeyhole aria-hidden="true" />
          <span>{copy.privacy}</span>
        </div>
        <dl className="profile-about-details">
          <div>
            <dt>{copy.preferredName}</dt>
            <dd>{renderValue(about.preferredName ?? "")}</dd>
          </div>
          <div>
            <dt>{copy.dateOfBirth}</dt>
            <dd>{renderValue(about.dateOfBirth ?? "")}</dd>
          </div>
          <div>
            <dt>{copy.interests}</dt>
            <dd>{renderValue(about.interests ?? "")}</dd>
          </div>
          <div className="profile-about-details__wide">
            <dt>{copy.bio}</dt>
            <dd>{renderValue(about.bio ?? "")}</dd>
          </div>
        </dl>
        <ProfileSaveFeedback feedback={feedback} />
      </Panel>
    );
  }

  return (
    <form
      id="profile-about-section"
      className="sh-panel profile-about-card profile-about-card--editing"
      aria-labelledby="profile-about-title"
      onSubmit={handleSubmit(async (values) => {
        const saved = await onSave({
          section: "about",
          about: {
            dateOfBirth: values.dateOfBirth || null,
            preferredName: values.preferredName || null,
            interests: values.interests || null,
            bio: values.bio || null,
          },
        });
        if (saved) setIsEditing(false);
      })}
    >
      <div className="sh-panel__head">
        <div className="sh-panel__heading">
          <p className="sh-panel__eyebrow">
            <span className="profile-about-eyebrow-mark" aria-hidden="true">
              <UserRound />
            </span>
            {copy.kicker}
          </p>
          <h2 className="sh-panel__title" id="profile-about-title">
            {copy.title}
          </h2>
          <UnsavedChangesIndicator dirty={isDirty} />
        </div>
        <div className="profile-section-action-group">
          <button
            className="profile-section-primary-button"
            type="submit"
            disabled={saving}
          >
            {saving ? copy.saving : copy.save}
          </button>
          {hasAbout ? (
            <button
              className="profile-section-secondary-button"
              type="button"
              onClick={() => {
                reset(initialValues);
                setIsEditing(false);
              }}
            >
              {copy.cancel}
            </button>
          ) : null}
        </div>
      </div>
      <hr className="sh-panel__divider" />
      <div className="sh-panel__body">
        <p className="profile-about-description">{copy.description}</p>
        <div className="profile-about-privacy" role="note">
          <LockKeyhole aria-hidden="true" />
          <span>{copy.privacy}</span>
        </div>
        <ProfileSaveFeedback feedback={feedback} />
        <div className="profile-about-fields">
          <div className="profile-about-field">
            <label htmlFor="profile-about-preferred-name">
              {copy.preferredName} <span>({copy.optional})</span>
            </label>
            <input
              id="profile-about-preferred-name"
              {...register("preferredName")}
              data-field-path="about.preferredName"
              maxLength={120}
              aria-invalid={Boolean(fieldError("about.preferredName"))}
              aria-describedby={fieldDescribedBy("about.preferredName")}
            />
            {fieldError("about.preferredName") ? (
              <p
                id="about-preferredName-error"
                className="profile-field-error"
              >
                {fieldError("about.preferredName")}
              </p>
            ) : null}
          </div>

          <div className="profile-about-field">
            <label htmlFor="profile-about-date-of-birth">
              {copy.dateOfBirth} <span>({copy.optional})</span>
            </label>
            <input
              id="profile-about-date-of-birth"
              type="date"
              {...register("dateOfBirth")}
              data-field-path="about.dateOfBirth"
              aria-invalid={Boolean(fieldError("about.dateOfBirth"))}
              aria-describedby={fieldDescribedBy(
                "about.dateOfBirth",
                "about-date-hint",
              )}
            />
            <p id="about-date-hint" className="profile-field-hint">
              {copy.dateHint}
            </p>
            {fieldError("about.dateOfBirth") ? (
              <p id="about-dateOfBirth-error" className="profile-field-error">
                {fieldError("about.dateOfBirth")}
              </p>
            ) : null}
          </div>

          <div className="profile-about-field">
            <label htmlFor="profile-about-interests">
              {copy.interests} <span>({copy.optional})</span>
            </label>
            <input
              id="profile-about-interests"
              {...register("interests")}
              data-field-path="about.interests"
              maxLength={500}
              aria-invalid={Boolean(fieldError("about.interests"))}
              aria-describedby={fieldDescribedBy("about.interests")}
            />
            {fieldError("about.interests") ? (
              <p id="about-interests-error" className="profile-field-error">
                {fieldError("about.interests")}
              </p>
            ) : null}
          </div>

          <div className="profile-about-field profile-about-field--wide">
            <label htmlFor="profile-about-bio">
              {copy.bio} <span>({copy.optional})</span>
            </label>
            <textarea
              id="profile-about-bio"
              {...register("bio")}
              data-field-path="about.bio"
              maxLength={1_000}
              rows={3}
              aria-invalid={Boolean(fieldError("about.bio"))}
              aria-describedby={fieldDescribedBy("about.bio", "about-bio-hint")}
            />
            <p id="about-bio-hint" className="profile-field-hint">
              {copy.bioHint}
            </p>
            {fieldError("about.bio") ? (
              <p id="about-bio-error" className="profile-field-error">
                {fieldError("about.bio")}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </form>
  );
}
