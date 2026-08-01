"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import {
  skillSuggestionsResponseSchema,
  type CandidateProfileContract,
} from "@/shared/contracts/account/profile";
import type { ProfileSectionDraft } from "../client/use-profile-editor";
import { useServerFormReconciliation } from "../client/use-server-form-reconciliation";
import {
  UnsavedChangesIndicator,
  useUnsavedChangesGuard,
} from "../client/unsaved-changes";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";

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
  const locale = useWorkspaceLocale();
  const copy =
    locale === "vi"
      ? {
          kicker: "THẾ MẠNH CÓ THỂ TÌM KIẾM",
          title: "Kỹ năng",
          saving: "Đang lưu kỹ năng…",
          save: "Lưu kỹ năng",
          empty: "Bạn chưa thêm kỹ năng nào.",
          skill: "Kỹ năng",
          up: "Di chuyển lên",
          down: "Di chuyển xuống",
          remove: "Xóa",
          suggestion: "Dùng gợi ý",
          add: "Thêm kỹ năng",
          suggestions: "Gợi ý kỹ năng",
        }
      : {
          kicker: "SEARCHABLE STRENGTHS",
          title: "Skills",
          saving: "Saving skills…",
          save: "Save skills",
          empty: "No skills added yet.",
          skill: "Skill",
          up: "Move up",
          down: "Move down",
          remove: "Remove",
          suggestion: "Use suggestion",
          add: "Add skill",
          suggestions: "Skill suggestions",
        };
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { isDirty },
  } = useForm<SkillValues>({
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
  useUnsavedChangesGuard(isDirty);

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
      id="profile-skills-section"
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
          <p className="panel-kicker">{copy.kicker}</p>
          <h2 id="profile-skills-title">{copy.title}</h2>
          <UnsavedChangesIndicator dirty={isDirty} />
        </div>
        <button type="submit" disabled={saving}>
          {saving ? copy.saving : copy.save}
        </button>
      </div>
      {fields.length === 0 ? <p>{copy.empty}</p> : null}
      <ol className="professional-profile-list">
        {fields.map((field, index) => (
          <li key={field.fieldKey} className="professional-profile-list-row">
            <input type="hidden" {...register(`skills.${index}.id`)} />
            <label htmlFor={`profile-skill-${index}`}>
              {copy.skill} {index + 1}
            </label>
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
                aria-label={
                  locale === "vi"
                    ? `Di chuyển kỹ năng ${index + 1} lên`
                    : `Move skill ${index + 1} up`
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
                    ? `Di chuyển kỹ năng ${index + 1} xuống`
                    : `Move skill ${index + 1} down`
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
                    ? `Xóa kỹ năng ${index + 1}`
                    : `Remove skill ${index + 1}`
                }
                onClick={() => remove(index)}
              >
                {copy.remove}
              </button>
            </div>
          </li>
        ))}
      </ol>
      {suggestions.length ? (
        <ul className="profile-suggestions" aria-label={copy.suggestions}>
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
                {copy.suggestion} {suggestion.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="professional-profile-add-row">
        <button
          type="button"
          disabled={fields.length >= 50}
          onClick={() => append({ label: "" })}
        >
          {copy.add}
        </button>
        <p className="profile-field-hint">{fields.length} / 50</p>
      </div>
    </form>
  );
}
