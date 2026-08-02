"use client";

import type { FormEvent } from "react";
import { useForm } from "react-hook-form";
import type { CandidateProfileContract } from "@/shared/contracts/account/profile";
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

type BasicsValues = {
  headline: string;
  summary: string;
  phone: string;
  location: string;
};

const valuesFrom = (
  basics: CandidateProfileContract["basics"],
): BasicsValues => ({
  headline: basics.headline ?? "",
  summary: basics.summary ?? "",
  phone: basics.phone ?? "",
  location: basics.location ?? "",
});

function growSummary(event: FormEvent<HTMLTextAreaElement>) {
  const textarea = event.currentTarget;
  textarea.style.height = "auto";
  textarea.style.height = `${Math.max(128, textarea.scrollHeight)}px`;
}

export function ProfileBasicsForm({
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
          kicker: "GIỚI THIỆU",
          title: "Thông tin nghề nghiệp cơ bản",
          saving: "Đang lưu…",
          save: "Lưu thông tin",
          headline: "Tiêu đề nghề nghiệp",
          summary: "Giới thiệu bản thân",
          phone: "Số điện thoại",
          phoneHint:
            "Dùng 7–15 chữ số; có thể thêm khoảng trắng, dấu chấm, gạch nối, ngoặc hoặc một dấu cộng ở đầu.",
          location: "Địa điểm",
        }
      : {
          kicker: "INTRODUCTION",
          title: "Professional basics",
          saving: "Saving basics…",
          save: "Save basics",
          headline: "Headline",
          summary: "Summary",
          phone: "Phone",
          phoneHint:
            "Use 7–15 digits with optional spaces, periods, hyphens, parentheses, or one leading plus.",
          location: "Location",
        };
  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<BasicsValues>({
    defaultValues: valuesFrom(profile.basics),
  });

  useServerFormReconciliation(valuesFrom(profile.basics), reset);
  useUnsavedChangesGuard(isDirty);

  const fieldError = (path: string) => feedback?.fieldErrors?.[path]?.[0];

  return (
    <form
      id="profile-basics-section"
      className="professional-profile-section"
      aria-labelledby="profile-basics-title"
      onSubmit={handleSubmit(async (values) => {
        await onSave({
          section: "basics",
          basics: {
            headline: values.headline || null,
            summary: values.summary || null,
            phone: values.phone || null,
            location: values.location || null,
          },
        });
      })}
    >
      <div className="professional-profile-section-heading">
        <div>
          <p className="panel-kicker">{copy.kicker}</p>
          <h2 id="profile-basics-title">{copy.title}</h2>
          <UnsavedChangesIndicator dirty={isDirty} />
        </div>
        <button type="submit" disabled={saving}>
          {saving ? copy.saving : copy.save}
        </button>
      </div>
      <ProfileSaveFeedback feedback={feedback} />
      <div className="professional-profile-fields">
        <label htmlFor="profile-headline">{copy.headline}</label>
        <input
          id="profile-headline"
          {...register("headline")}
          data-field-path="basics.headline"
          maxLength={200}
          aria-invalid={Boolean(fieldError("basics.headline"))}
          aria-describedby={
            fieldError("basics.headline") ? "profile-headline-error" : undefined
          }
        />
        {fieldError("basics.headline") ? (
          <p id="profile-headline-error" className="profile-field-error">
            {fieldError("basics.headline")}
          </p>
        ) : null}

        <label htmlFor="profile-summary">{copy.summary}</label>
        <textarea
          id="profile-summary"
          {...register("summary")}
          data-field-path="basics.summary"
          maxLength={5_000}
          rows={5}
          onInput={growSummary}
          aria-invalid={Boolean(fieldError("basics.summary"))}
          aria-describedby={
            fieldError("basics.summary") ? "profile-summary-error" : undefined
          }
        />
        {fieldError("basics.summary") ? (
          <p id="profile-summary-error" className="profile-field-error">
            {fieldError("basics.summary")}
          </p>
        ) : null}

        <label htmlFor="profile-phone">{copy.phone}</label>
        <input
          id="profile-phone"
          {...register("phone")}
          data-field-path="basics.phone"
          inputMode="tel"
          maxLength={32}
          aria-invalid={Boolean(fieldError("basics.phone"))}
          aria-describedby={
            fieldError("basics.phone")
              ? "profile-phone-hint profile-phone-error"
              : "profile-phone-hint"
          }
        />
        <p id="profile-phone-hint" className="profile-field-hint">
          {copy.phoneHint}
        </p>
        {fieldError("basics.phone") ? (
          <p id="profile-phone-error" className="profile-field-error">
            {fieldError("basics.phone")}
          </p>
        ) : null}

        <label htmlFor="profile-location">{copy.location}</label>
        <input
          id="profile-location"
          {...register("location")}
          data-field-path="basics.location"
          maxLength={160}
          aria-invalid={Boolean(fieldError("basics.location"))}
          aria-describedby={
            fieldError("basics.location") ? "profile-location-error" : undefined
          }
        />
        {fieldError("basics.location") ? (
          <p id="profile-location-error" className="profile-field-error">
            {fieldError("basics.location")}
          </p>
        ) : null}
      </div>
    </form>
  );
}
