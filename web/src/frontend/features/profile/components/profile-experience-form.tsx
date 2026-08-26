"use client";

import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { useState, type FormEvent } from "react";
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
import { BriefcaseBusiness, CirclePlus } from "lucide-react";
import { Timeline, TimelineItem } from "@/frontend/components/ui/design-system";

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

function growDescription(event: FormEvent<HTMLTextAreaElement>) {
  const textarea = event.currentTarget;
  textarea.style.height = "auto";
  textarea.style.height = `${Math.max(112, textarea.scrollHeight)}px`;
}

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
          kicker: "Kinh nghiệm",
          title: "Quá trình làm việc",
          count: (count: number) => `${count} vị trí`,
          saving: "Đang lưu kinh nghiệm…",
          save: "Lưu kinh nghiệm",
          empty: "Bạn chưa thêm kinh nghiệm nào.",
          entry: "Kinh nghiệm",
          role: "Chức danh",
          company: "Công ty",
          description: "Mô tả",
          start: "Ngày bắt đầu",
          end: "Ngày kết thúc",
          current: "Hiện tại",
          up: "Di chuyển lên",
          down: "Di chuyển xuống",
          remove: "Xóa",
          add: "+ Thêm kinh nghiệm",
          addOther: "Thêm kinh nghiệm khác",
          addOtherSub: "Bổ sung công việc, dự án hoặc hoạt động ngoại khoá",
        }
      : {
          kicker: "Experience",
          title: "Work history",
          count: (count: number) =>
            `${count} ${count === 1 ? "position" : "positions"}`,
          saving: "Saving experience…",
          save: "Save experience",
          empty: "No experience added yet.",
          entry: "Experience",
          role: "Title",
          company: "Company",
          description: "Description",
          start: "Start date",
          end: "End date",
          current: "Current",
          up: "Move up",
          down: "Move down",
          remove: "Remove",
          add: "+ Add experience",
          addOther: "Add another experience",
          addOtherSub: "Add roles, projects, or extracurricular activities",
        };
  const editLabel =
    locale === "vi" ? "Chỉnh sửa kinh nghiệm" : "Edit experience";
  const cancelLabel = locale === "vi" ? "Hủy" : "Cancel";
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
  const hasExperience = profile.experience.length > 0;
  const [isEditing, setIsEditing] = useState(!hasExperience);

  useServerFormReconciliation(valuesFrom(profile), reset);
  useUnsavedChangesGuard(isDirty && isEditing);

  const fieldError = (path: string) => feedback?.fieldErrors?.[path]?.[0];

  if (!isEditing) {
    return (
      <ProfileCompactSection
        sectionId="profile-experience-section"
        titleId="profile-experience-title"
        kicker={copy.kicker}
        title={copy.title}
        mark="EX"
        count={copy.count(profile.experience.length)}
        feedback={<ProfileSaveFeedback feedback={feedback} />}
        content={
          hasExperience ? (
            <>
              <Timeline
                aria-label="Saved experience"
                className="profile-timeline"
              >
                {profile.experience.map((entry, idx) => (
                  <TimelineItem
                    key={entry.id || idx}
                    icon={<BriefcaseBusiness />}
                    title={entry.title}
                    current={entry.current ? copy.current : undefined}
                    subtitle={`${entry.company} · ${formatProfileDateRange(
                      entry.startDate,
                      entry.endDate,
                      entry.current,
                      locale,
                    )}`}
                    description={entry.description || undefined}
                    showConnector={idx < profile.experience.length - 1}
                  />
                ))}
              </Timeline>
              <button
                type="button"
                className="candidate-add-card"
                onClick={() => setIsEditing(true)}
              >
                <CirclePlus aria-hidden="true" />
                <span className="candidate-add-card__copy">
                  <strong>{copy.addOther}</strong>
                  <small>{copy.addOtherSub}</small>
                </span>
              </button>
            </>
          ) : (
            <div className="profile-compact-empty-text">
              <strong>{copy.empty}</strong>
              <span>
                {locale === "vi"
                  ? "Bổ sung quá trình làm việc để nhà tuyển dụng hiểu rõ năng lực của bạn."
                  : "Show employers where you have applied your skills."}
              </span>
            </div>
          )
        }
        action={
          <button
            className={
              hasExperience
                ? "profile-section-edit-button btn-ghost"
                : "profile-section-secondary-button"
            }
            style={
              hasExperience ? { width: "auto", padding: "6px 14px" } : undefined
            }
            type="button"
            onClick={() => setIsEditing(true)}
          >
            {hasExperience ? editLabel : copy.add}
          </button>
        }
      />
    );
  }

  return (
    <form
      id="profile-experience-section"
      className="candidate-section candidate-section--editing"
      aria-labelledby="profile-experience-title"
      onSubmit={handleSubmit(async ({ experience }) => {
        const saved = await onSave({
          section: "experience",
          experience: experience.map(({ id, ...entry }) => ({
            ...(id ? { id } : {}),
            ...entry,
            description: entry.description || null,
            endDate: entry.current ? null : entry.endDate || null,
          })),
        });
        if (saved) setIsEditing(false);
      })}
    >
      <div className="professional-profile-section-heading">
        <div>
          <p className="panel-kicker">{copy.kicker}</p>
          <h2 id="profile-experience-title">{copy.title}</h2>
          <UnsavedChangesIndicator dirty={isDirty} />
        </div>
        <div className="profile-section-action-group">
          <button type="submit" disabled={saving}>
            {saving ? copy.saving : copy.save}
          </button>
          {hasExperience ? (
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
                  onInput={growDescription}
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
                  aria-label={
                    locale === "vi" ? "Vai trò hiện tại" : "Current role"
                  }
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
          aria-label={locale === "vi" ? "Thêm kinh nghiệm" : "Add experience"}
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
