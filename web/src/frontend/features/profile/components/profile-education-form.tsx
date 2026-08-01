"use client";

import { useFieldArray, useForm } from "react-hook-form";
import type { CandidateProfileContract } from "@/shared/contracts/account/profile";
import type { ProfileSectionDraft } from "../client/use-profile-editor";
import { useServerFormReconciliation } from "../client/use-server-form-reconciliation";

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
  onSave,
}: {
  profile: CandidateProfileContract;
  saving: boolean;
  onSave: (draft: ProfileSectionDraft) => Promise<boolean>;
}) {
  const { control, register, handleSubmit, reset } = useForm<EducationValues>({
    defaultValues: valuesFrom(profile),
  });
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "education",
    keyName: "fieldKey",
  });

  useServerFormReconciliation(valuesFrom(profile), reset);

  return (
    <form
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
          <p className="panel-kicker">LEARNING</p>
          <h2 id="profile-education-title">Education</h2>
        </div>
        <button type="submit" disabled={saving}>
          {saving ? "Saving education…" : "Save education"}
        </button>
      </div>
      {fields.length === 0 ? <p>No education added yet.</p> : null}
      <ol className="professional-profile-list">
        {fields.map((field, index) => (
          <li key={field.fieldKey}>
            <fieldset aria-label={`Education ${index + 1}`}>
              <legend>Education {index + 1}</legend>
              <input type="hidden" {...register(`education.${index}.id`)} />
              <label>
                Institution
                <input
                  required
                  maxLength={200}
                  {...register(`education.${index}.institution`)}
                />
              </label>
              <label>
                Degree
                <input
                  required
                  maxLength={200}
                  {...register(`education.${index}.degree`)}
                />
              </label>
              <label>
                Field of study
                <input
                  maxLength={200}
                  {...register(`education.${index}.field`)}
                />
              </label>
              <label>
                Start date
                <input
                  type="date"
                  required
                  {...register(`education.${index}.startDate`)}
                />
              </label>
              <label>
                End date
                <input
                  type="date"
                  {...register(`education.${index}.endDate`)}
                />
              </label>
              <label className="professional-profile-checkbox">
                <input
                  type="checkbox"
                  {...register(`education.${index}.current`)}
                />
                Currently studying
              </label>
              <div className="professional-profile-row-actions">
                <button
                  type="button"
                  aria-label={`Move education ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  Move up
                </button>
                <button
                  type="button"
                  aria-label={`Move education ${index + 1} down`}
                  disabled={index === fields.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  Move down
                </button>
                <button
                  type="button"
                  aria-label={`Remove education ${index + 1}`}
                  onClick={() => remove(index)}
                >
                  Remove
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
          Add education
        </button>
        <p className="profile-field-hint">{fields.length} of 50 entries</p>
      </div>
    </form>
  );
}
