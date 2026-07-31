"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import {
  skillSuggestionsResponseSchema,
  type CandidateProfileContract,
} from "@/shared/contracts/account/profile";
import type { ProfileSectionDraft } from "../client/use-profile-editor";
import { useServerFormReconciliation } from "../client/use-server-form-reconciliation";

type SkillValues = {
  skills: Array<{ id?: string; label: string }>;
};

export function ProfileSkillsForm({
  profile,
  saving,
  onSave,
}: {
  profile: CandidateProfileContract;
  saving: boolean;
  onSave: (draft: ProfileSectionDraft) => Promise<boolean>;
}) {
  const { control, register, handleSubmit, reset, setValue } =
    useForm<SkillValues>({
      defaultValues: { skills: profile.skills },
    });
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "skills",
    keyName: "fieldKey",
  });
  const [activeIndex, setActiveIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [suggestionResult, setSuggestionResult] = useState<{
    query: string;
    items: Array<{ id: string; label: string }>;
  }>({ query: "", items: [] });
  const normalizedQuery = query.trim();
  const suggestions =
    suggestionResult.query === normalizedQuery ? suggestionResult.items : [];

  useServerFormReconciliation({ skills: profile.skills }, reset);

  useEffect(() => {
    if (!normalizedQuery) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/account/profile/skills/suggestions?query=${encodeURIComponent(
            normalizedQuery,
          )}&limit=10`,
          { cache: "no-store", signal: controller.signal },
        );
        const parsed = skillSuggestionsResponseSchema.safeParse(
          await response.json(),
        );
        setSuggestionResult({
          query: normalizedQuery,
          items: response.ok && parsed.success ? parsed.data.skills : [],
        });
      } catch {
        if (!controller.signal.aborted) {
          setSuggestionResult({ query: normalizedQuery, items: [] });
        }
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [normalizedQuery]);

  return (
    <form
      className="professional-profile-section"
      aria-labelledby="profile-skills-title"
      onSubmit={handleSubmit(async ({ skills }) => {
        await onSave({
          section: "skills",
          skills: skills.map(({ id, label }) =>
            id ? { id, label } : { label },
          ),
        });
      })}
    >
      <div className="professional-profile-section-heading">
        <div>
          <p className="panel-kicker">SEARCHABLE STRENGTHS</p>
          <h2 id="profile-skills-title">Skills</h2>
        </div>
        <button type="submit" disabled={saving}>
          {saving ? "Saving skills…" : "Save skills"}
        </button>
      </div>
      {fields.length === 0 ? <p>No skills added yet.</p> : null}
      <ol className="professional-profile-list">
        {fields.map((field, index) => (
          <li key={field.fieldKey} className="professional-profile-list-row">
            <input type="hidden" {...register(`skills.${index}.id`)} />
            <label htmlFor={`profile-skill-${index}`}>Skill {index + 1}</label>
            <input
              id={`profile-skill-${index}`}
              maxLength={80}
              autoComplete="off"
              {...register(`skills.${index}.label`, {
                onChange: (event) => {
                  setActiveIndex(index);
                  setQuery(String(event.target.value));
                },
              })}
            />
            <div className="professional-profile-row-actions">
              <button
                type="button"
                aria-label={`Move skill ${index + 1} up`}
                disabled={index === 0}
                onClick={() => move(index, index - 1)}
              >
                Move up
              </button>
              <button
                type="button"
                aria-label={`Move skill ${index + 1} down`}
                disabled={index === fields.length - 1}
                onClick={() => move(index, index + 1)}
              >
                Move down
              </button>
              <button
                type="button"
                aria-label={`Remove skill ${index + 1}`}
                onClick={() => remove(index)}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ol>
      {suggestions.length ? (
        <ul className="profile-suggestions" aria-label="Skill suggestions">
          {suggestions.map((suggestion) => (
            <li key={suggestion.id}>
              <button
                type="button"
                onClick={() => {
                  setValue(`skills.${activeIndex}`, suggestion, {
                    shouldDirty: true,
                  });
                  setQuery("");
                }}
              >
                Use suggestion {suggestion.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        disabled={fields.length >= 50}
        onClick={() => append({ label: "" })}
      >
        Add skill
      </button>
      <p className="profile-field-hint">{fields.length} of 50 skills</p>
    </form>
  );
}
