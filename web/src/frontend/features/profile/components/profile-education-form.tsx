"use client";

import { useFieldArray, useForm } from "react-hook-form";
import { useState } from "react";
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
import { ProfileCompactSection } from "./profile-compact-section";
import { ProfileSaveFeedback } from "./profile-save-feedback";
import { formatProfileDateRange } from "./profile-display";
import { CirclePlus, GraduationCap } from "lucide-react";
import { Badge } from "@/frontend/components/ui/badge";

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
          kicker: "Học vấn",
          title: "Quá trình học tập",
          count: (count: number) => `${count} mục`,
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
          add: "+ Thêm học vấn",
          addOther: "Thêm bằng cấp hoặc chứng chỉ",
          saved: "Thông tin học vấn đã lưu",
        }
      : {
          kicker: "Education",
          title: "Academic background",
          count: (count: number) =>
            `${count} ${count === 1 ? "item" : "items"}`,
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
          add: "+ Add education",
          addOther: "Add degree or certification",
          saved: "Saved education",
        };
  const editLabel = locale === "vi" ? "Chỉnh sửa học vấn" : "Edit education";
  const cancelLabel = locale === "vi" ? "Hủy" : "Cancel";
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
  const hasEducation = profile.education.length > 0;
  const [isEditing, setIsEditing] = useState(!hasEducation);

  useServerFormReconciliation(valuesFrom(profile), reset);
  useUnsavedChangesGuard(isDirty && isEditing);

  const fieldError = (path: string) => feedback?.fieldErrors?.[path]?.[0];

  if (!isEditing) {
    return (
      <ProfileCompactSection
        sectionId="profile-education-section"
        titleId="profile-education-title"
        kicker={copy.kicker}
        title={copy.title}
        mark="ED"
        count={copy.count(profile.education.length)}
        feedback={<ProfileSaveFeedback feedback={feedback} />}
        content={
          hasEducation ? (
            <>
              <div
                className="edu-row sh-education-grid"
                aria-label={copy.saved}
              >
                {profile.education.map((entry, idx) => (
                  <div className="edu-card" key={entry.id || idx}>
                    <Badge
                      tone="blue"
                      icon={<GraduationCap />}
                      aria-hidden="true"
                    />
                    <div>
                      <p className="edu-title">{entry.degree}</p>
                      <p className="edu-sub">
                        {entry.institution}
                        {entry.field ? ` · ${entry.field}` : ""} ·{" "}
                        {formatProfileDateRange(
                          entry.startDate,
                          entry.endDate,
                          entry.current,
                          locale,
                        )}
                      </p>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="edu-card candidate-add-card"
                  onClick={() => setIsEditing(true)}
                >
                  <CirclePlus aria-hidden="true" />
                  <span className="candidate-add-card__copy">
                    <strong>{copy.addOther}</strong>
                  </span>
                </button>
              </div>
            </>
          ) : (
            <div className="profile-compact-empty-text">
              <strong>{copy.empty}</strong>
              <span>
                {locale === "vi"
                  ? "Bổ sung quá trình học tập và chuyên ngành của bạn."
                  : "Add your academic background and field of study."}
              </span>
            </div>
          )
        }
        action={
          <button
            className={
              hasEducation
                ? "profile-section-edit-button btn-ghost"
                : "profile-section-secondary-button"
            }
            style={
              hasEducation ? { width: "auto", padding: "6px 14px" } : undefined
            }
            type="button"
            onClick={() => setIsEditing(true)}
          >
            {hasEducation ? editLabel : copy.add}
          </button>
        }
      />
    );
  }

  return (
    <form
      id="profile-education-section"
      className="candidate-section candidate-section--editing"
      aria-labelledby="profile-education-title"
      onSubmit={handleSubmit(async ({ education }) => {
        const saved = await onSave({
          section: "education",
          education: education.map(({ id, ...entry }) => ({
            ...(id ? { id } : {}),
            ...entry,
            field: entry.field || null,
            endDate: entry.endDate || null,
          })),
        });
        if (saved) setIsEditing(false);
      })}
    >
      <div className="professional-profile-section-heading">
        <div>
          <p className="panel-kicker">{copy.kicker}</p>
          <h2 id="profile-education-title">{copy.title}</h2>
          <UnsavedChangesIndicator dirty={isDirty} />
        </div>
        <div className="profile-section-action-group">
          <button type="submit" disabled={saving}>
            {saving ? copy.saving : copy.save}
          </button>
          {hasEducation ? (
            <button
              className="profile-section-secondary-button"
              type="button"
              onClick={() => {
                reset(valuesFrom(profile));
                setIsEditing(false);
              }}
            >
              {cancelLabel}
            </button>
          ) : null}
        </div>
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
          aria-label={locale === "vi" ? "Thêm học vấn" : "Add education"}
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
