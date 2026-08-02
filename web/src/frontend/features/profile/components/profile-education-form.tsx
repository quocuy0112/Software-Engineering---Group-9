"use client";

import { useFieldArray, useForm } from "react-hook-form";
import type { CandidateProfileContract } from "@/shared/contracts/account/profile";
import type {
  ProfileEditorFeedback,
  ProfileSectionDraft,
} from "../client/use-profile-editor";
import { useServerFormReconciliation } from "../client/use-server-form-reconciliation";
import {
  UnsavedChangesIndicator,
  useUnsavedChangesGuard,
} from "../client/unsaved-changes";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import { ProfileSaveFeedback } from "./profile-save-feedback";

type EducationValues = {
  education: Array<{
    id?: string;
    institution: string;
    degree: string;
    field: string;
    startDate: string;
    endDate: string;
    current: boolean;
  }>;
};

const valuesFrom = (profile: CandidateProfileContract): EducationValues => ({
  education: profile.education.map((entry) => ({
    ...entry,
    field: entry.field ?? "",
    endDate: entry.endDate ?? "",
  })),
});

export function ProfileEducationForm({
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
          kicker: "HỌC VẤN",
          title: "Học vấn",
          saving: "Đang lưu học vấn…",
          save: "Lưu học vấn",
          empty: "Bạn chưa thêm thông tin học vấn.",
          entry: "Học vấn",
          institution: "Trường / Cơ sở đào tạo",
          degree: "Bằng cấp",
          field: "Chuyên ngành",
          start: "Ngày bắt đầu",
          end: "Ngày kết thúc",
          current: "Đang theo học",
          up: "Di chuyển lên",
          down: "Di chuyển xuống",
          remove: "Xóa",
          add: "Thêm học vấn",
        }
      : {
          kicker: "LEARNING",
          title: "Education",
          saving: "Saving education…",
          save: "Save education",
          empty: "No education added yet.",
          entry: "Education",
          institution: "Institution",
          degree: "Degree",
          field: "Field of study",
          start: "Start date",
          end: "End date",
          current: "Currently studying",
          up: "Move up",
          down: "Move down",
          remove: "Remove",
          add: "Add education",
        };
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<EducationValues>({ defaultValues: valuesFrom(profile) });
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "education",
    keyName: "fieldKey",
  });

  useServerFormReconciliation(valuesFrom(profile), reset);
  useUnsavedChangesGuard(isDirty);

  const fieldError = (path: string) => feedback?.fieldErrors?.[path]?.[0];

  return (
    <form
      id="profile-education-section"
      className="professional-profile-section"
      aria-labelledby="profile-education-title"
      onSubmit={handleSubmit(async ({ education }) => {
        await onSave({
          section: "education",
          education: education.map(({ id, ...entry }) => ({
            ...(id ? { id } : {}),
            ...entry,
            field: entry.field || null,
            endDate: entry.endDate || null,
          })),
        });
      })}
    >
      <div className="professional-profile-section-heading">
        <div>
          <p className="panel-kicker">{copy.kicker}</p>
          <h2 id="profile-education-title">{copy.title}</h2>
          <UnsavedChangesIndicator dirty={isDirty} />
        </div>
        <button type="submit" disabled={saving}>
          {saving ? copy.saving : copy.save}
        </button>
      </div>
      <ProfileSaveFeedback feedback={feedback} />
      {fields.length === 0 ? <p>{copy.empty}</p> : null}
      <ol className="professional-profile-list">
        {fields.map((field, index) => (
          <li key={field.fieldKey}>
            <fieldset aria-label={`${copy.entry} ${index + 1}`}>
              <legend>
                {copy.entry} {index + 1}
              </legend>
              <input type="hidden" {...register(`education.${index}.id`)} />
              <label>
                {copy.institution}
                <input
                  required
                  maxLength={200}
                  data-field-path={`education.${index}.institution`}
                  aria-invalid={Boolean(
                    fieldError(`education.${index}.institution`),
                  )}
                  {...register(`education.${index}.institution`)}
                />
              </label>
              <label>
                {copy.degree}
                <input
                  required
                  maxLength={200}
                  data-field-path={`education.${index}.degree`}
                  aria-invalid={Boolean(
                    fieldError(`education.${index}.degree`),
                  )}
                  {...register(`education.${index}.degree`)}
                />
              </label>
              <label>
                {copy.field}
                <input
                  maxLength={200}
                  data-field-path={`education.${index}.field`}
                  aria-invalid={Boolean(fieldError(`education.${index}.field`))}
                  {...register(`education.${index}.field`)}
                />
              </label>
              <label>
                {copy.start}
                <input
                  type="date"
                  required
                  data-field-path={`education.${index}.startDate`}
                  aria-invalid={Boolean(
                    fieldError(`education.${index}.startDate`),
                  )}
                  {...register(`education.${index}.startDate`)}
                />
              </label>
              <label>
                {copy.end}
                <input
                  type="date"
                  data-field-path={`education.${index}.endDate`}
                  aria-invalid={Boolean(
                    fieldError(`education.${index}.endDate`),
                  )}
                  {...register(`education.${index}.endDate`)}
                />
              </label>
              <label className="professional-profile-checkbox">
                <input
                  type="checkbox"
                  data-field-path={`education.${index}.current`}
                  aria-invalid={Boolean(
                    fieldError(`education.${index}.current`),
                  )}
                  {...register(`education.${index}.current`)}
                />
                {copy.current}
              </label>
              <div className="professional-profile-row-actions">
                <button
                  type="button"
                  aria-label={
                    locale === "vi"
                      ? `Di chuyển học vấn ${index + 1} lên`
                      : `Move education ${index + 1} up`
                  }
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  {copy.up}
                </button>
                <button
                  type="button"
                  aria-label={
                    locale === "vi"
                      ? `Di chuyển học vấn ${index + 1} xuống`
                      : `Move education ${index + 1} down`
                  }
                  disabled={index === fields.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  {copy.down}
                </button>
                <button
                  type="button"
                  aria-label={
                    locale === "vi"
                      ? `Xóa học vấn ${index + 1}`
                      : `Remove education ${index + 1}`
                  }
                  onClick={() => remove(index)}
                >
                  {copy.remove}
                </button>
              </div>
            </fieldset>
          </li>
        ))}
      </ol>
      <div className="professional-profile-add-row">
        <button
          type="button"
          disabled={fields.length >= 50}
          onClick={() =>
            append({
              institution: "",
              degree: "",
              field: "",
              startDate: "",
              endDate: "",
              current: false,
            })
          }
        >
          {copy.add}
        </button>
        <p className="profile-field-hint">{fields.length} / 50</p>
      </div>
    </form>
  );
}
