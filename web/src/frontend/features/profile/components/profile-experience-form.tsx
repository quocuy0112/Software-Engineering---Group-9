"use client";

import { useFieldArray, useForm, useWatch } from "react-hook-form";
import type { CandidateProfileContract } from "@/shared/contracts/account/profile";
import type { ProfileSectionDraft } from "../client/use-profile-editor";
import { useServerFormReconciliation } from "../client/use-server-form-reconciliation";

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
  onSave,
}: {
  profile: CandidateProfileContract;
  saving: boolean;
  onSave: (draft: ProfileSectionDraft) => Promise<boolean>;
}) {
  const { control, register, handleSubmit, reset, setValue } =
    useForm<ExperienceValues>({ defaultValues: valuesFrom(profile) });
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "experience",
    keyName: "fieldKey",
  });
  const values = useWatch({ control, name: "experience" });

  useServerFormReconciliation(valuesFrom(profile), reset);

  return (
    <form
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
          <p className="panel-kicker">WORK HISTORY</p>
          <h2 id="profile-experience-title">Experience</h2>
        </div>
        <button type="submit" disabled={saving}>
          {saving ? "Saving experience…" : "Save experience"}
        </button>
      </div>
      {fields.length === 0 ? <p>No experience added yet.</p> : null}
      <ol className="professional-profile-list">
        {fields.map((field, index) => (
          <li key={field.fieldKey}>
            <fieldset aria-label={`Experience ${index + 1}`}>
              <legend>Experience {index + 1}</legend>
              <input type="hidden" {...register(`experience.${index}.id`)} />
              <label>
                Title
                <input
                  maxLength={200}
                  required
                  {...register(`experience.${index}.title`)}
                />
              </label>
              <label>
                Company
                <input
                  maxLength={200}
                  required
                  {...register(`experience.${index}.company`)}
                />
              </label>
              <label>
                Description
                <textarea
                  maxLength={3_000}
                  rows={4}
                  {...register(`experience.${index}.description`)}
                />
              </label>
              <label>
                Start date
                <input
                  type="date"
                  required
                  {...register(`experience.${index}.startDate`)}
                />
              </label>
              <label>
                End date
                <input
                  type="date"
                  disabled={values[index]?.current}
                  {...register(`experience.${index}.endDate`)}
                />
              </label>
              <label className="professional-profile-checkbox">
                <input
                  type="checkbox"
                  {...register(`experience.${index}.current`, {
                    onChange: (event) => {
                      if (event.target.checked) {
                        setValue(`experience.${index}.endDate`, "");
                      }
                    },
                  })}
                />
                Current role
              </label>
              <div className="professional-profile-row-actions">
                <button
                  type="button"
                  aria-label={`Move experience ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  Move up
                </button>
                <button
                  type="button"
                  aria-label={`Move experience ${index + 1} down`}
                  disabled={index === fields.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  Move down
                </button>
                <button
                  type="button"
                  aria-label={`Remove experience ${index + 1}`}
                  onClick={() => remove(index)}
                >
                  Remove
                </button>
              </div>
            </fieldset>
          </li>
        ))}
      </ol>
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
        Add experience
      </button>
      <p className="profile-field-hint">{fields.length} of 50 entries</p>
    </form>
  );
}
