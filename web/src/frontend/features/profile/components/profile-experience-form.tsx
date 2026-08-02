"use client";

import { useFieldArray, useForm, useWatch } from "react-hook-form";
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

type ExperienceValues = {
  experience: Array<{
    id?: string;
    title: string;
    company: string;
    description: string;
    startDate: string;
    endDate: string;
    current: boolean;
  }>;
};

const valuesFrom = (profile: CandidateProfileContract): ExperienceValues => ({
  experience: profile.experience.map((entry) => ({
    ...entry,
    description: entry.description ?? "",
    endDate: entry.endDate ?? "",
  })),
});

export function ProfileExperienceForm({
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
          kicker: "KINH NGHIỆM LÀM VIỆC",
          title: "Kinh nghiệm",
          saving: "Đang lưu kinh nghiệm…",
          save: "Lưu kinh nghiệm",
          empty: "Bạn chưa thêm kinh nghiệm nào.",
          entry: "Kinh nghiệm",
          role: "Chức danh",
          company: "Công ty",
          description: "Mô tả",
          start: "Ngày bắt đầu",
          end: "Ngày kết thúc",
          current: "Đang làm việc tại đây",
          up: "Di chuyển lên",
          down: "Di chuyển xuống",
          remove: "Xóa",
          add: "Thêm kinh nghiệm",
        }
      : {
          kicker: "WORK HISTORY",
          title: "Experience",
          saving: "Saving experience…",
          save: "Save experience",
          empty: "No experience added yet.",
          entry: "Experience",
          role: "Title",
          company: "Company",
          description: "Description",
          start: "Start date",
          end: "End date",
          current: "Current role",
          up: "Move up",
          down: "Move down",
          remove: "Remove",
          add: "Add experience",
        };
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { isDirty },
  } = useForm<ExperienceValues>({ defaultValues: valuesFrom(profile) });
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "experience",
    keyName: "fieldKey",
  });
  const values = useWatch({ control, name: "experience" });

  useServerFormReconciliation(valuesFrom(profile), reset);
  useUnsavedChangesGuard(isDirty);

  const fieldError = (path: string) => feedback?.fieldErrors?.[path]?.[0];

  return (
    <form
      id="profile-experience-section"
      className="professional-profile-section"
      aria-labelledby="profile-experience-title"
      onSubmit={handleSubmit(async ({ experience }) => {
        await onSave({
          section: "experience",
          experience: experience.map(({ id, ...entry }) => ({
            ...(id ? { id } : {}),
            ...entry,
            description: entry.description || null,
            endDate: entry.current ? null : entry.endDate || null,
          })),
        });
      })}
    >
      <div className="professional-profile-section-heading">
        <div>
          <p className="panel-kicker">{copy.kicker}</p>
          <h2 id="profile-experience-title">{copy.title}</h2>
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
              <input type="hidden" {...register(`experience.${index}.id`)} />
              <label>
                {copy.role}
                <input
                  maxLength={200}
                  required
                  data-field-path={`experience.${index}.title`}
                  aria-invalid={Boolean(
                    fieldError(`experience.${index}.title`),
                  )}
                  {...register(`experience.${index}.title`)}
                />
              </label>
              <label>
                {copy.company}
                <input
                  maxLength={200}
                  required
                  data-field-path={`experience.${index}.company`}
                  aria-invalid={Boolean(
                    fieldError(`experience.${index}.company`),
                  )}
                  {...register(`experience.${index}.company`)}
                />
              </label>
              <label>
                {copy.description}
                <textarea
                  maxLength={3_000}
                  rows={4}
                  data-field-path={`experience.${index}.description`}
                  aria-invalid={Boolean(
                    fieldError(`experience.${index}.description`),
                  )}
                  {...register(`experience.${index}.description`)}
                />
              </label>
              <label>
                {copy.start}
                <input
                  type="date"
                  required
                  data-field-path={`experience.${index}.startDate`}
                  aria-invalid={Boolean(
                    fieldError(`experience.${index}.startDate`),
                  )}
                  {...register(`experience.${index}.startDate`)}
                />
              </label>
              <label>
                {copy.end}
                <input
                  type="date"
                  disabled={values[index]?.current}
                  data-field-path={`experience.${index}.endDate`}
                  aria-invalid={Boolean(
                    fieldError(`experience.${index}.endDate`),
                  )}
                  {...register(`experience.${index}.endDate`)}
                />
              </label>
              <label className="professional-profile-checkbox">
                <input
                  type="checkbox"
                  data-field-path={`experience.${index}.current`}
                  aria-invalid={Boolean(
                    fieldError(`experience.${index}.current`),
                  )}
                  {...register(`experience.${index}.current`, {
                    onChange: (event) => {
                      if (event.target.checked) {
                        setValue(`experience.${index}.endDate`, "");
                      }
                    },
                  })}
                />
                {copy.current}
              </label>
              <div className="professional-profile-row-actions">
                <button
                  type="button"
                  aria-label={
                    locale === "vi"
                      ? `Di chuyển kinh nghiệm ${index + 1} lên`
                      : `Move experience ${index + 1} up`
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
                      ? `Di chuyển kinh nghiệm ${index + 1} xuống`
                      : `Move experience ${index + 1} down`
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
                      ? `Xóa kinh nghiệm ${index + 1}`
                      : `Remove experience ${index + 1}`
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
              title: "",
              company: "",
              description: "",
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
