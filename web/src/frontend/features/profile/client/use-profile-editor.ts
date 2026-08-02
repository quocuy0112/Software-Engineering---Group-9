"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  candidateProfileSchema,
  profileMutationOutcomeSchema,
  type CandidateProfileContract,
  type ProfileSectionMutation,
} from "@/shared/contracts/account/profile";
import type { AccountError } from "@/shared/contracts/account/common";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import {
  localizeAccountMessage,
  localizeFieldErrors,
} from "./localized-account-feedback";

type WithoutBaseRevision<T> = T extends unknown
  ? Omit<T, "baseRevision">
  : never;
export type ProfileSectionDraft = WithoutBaseRevision<ProfileSectionMutation>;
export type ProfileSectionName = ProfileSectionMutation["section"];

export type ProfileEditorFeedback = {
  section: ProfileSectionName;
  kind: "success" | "warning" | "error";
  message: string;
  fieldErrors?: Record<string, string[]>;
};

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function useProfileEditor(
  initialProfile: CandidateProfileContract | undefined,
  csrfProof: string,
) {
  const locale = useWorkspaceLocale();
  const [profile, setProfile] = useState(initialProfile);
  const [loading, setLoading] = useState(initialProfile === undefined);
  const [loadError, setLoadError] = useState(false);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ProfileEditorFeedback | null>(null);
  const savingRef = useRef<string | null>(null);

  const load = useCallback(async (showLoading: boolean) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch("/api/account/profile", {
        cache: "no-store",
      });
      const body = await safeJson(response);
      const parsed = candidateProfileSchema.safeParse(body);
      if (!response.ok || !parsed.success)
        throw new Error("PROFILE_LOAD_FAILED");
      setProfile(parsed.data);
      setLoadError(false);
    } catch {
      if (showLoading) setLoadError(true);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialProfile !== undefined) return;
    const timer = window.setTimeout(() => {
      void load(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialProfile, load]);

  const focusFirstError = useCallback((errors?: Record<string, string[]>) => {
    const field = errors ? Object.keys(errors)[0] : undefined;
    if (!field) return;
    setTimeout(() => {
      Array.from(document.querySelectorAll<HTMLElement>("[data-field-path]"))
        .find((element) => element.dataset.fieldPath === field)
        ?.focus();
    }, 0);
  }, []);

  const save = useCallback(
    async (draft: ProfileSectionDraft): Promise<boolean> => {
      if (!profile || savingRef.current) return false;
      savingRef.current = draft.section;
      setSavingSection(draft.section);
      setFeedback(null);
      try {
        const response = await fetch("/api/account/profile", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfProof,
          },
          body: JSON.stringify({
            ...draft,
            baseRevision: profile.revision,
          }),
        });
        const body = await safeJson(response);
        if (!response.ok) {
          const accountError = (body ?? {}) as Partial<AccountError>;
          const next: ProfileEditorFeedback = {
            section: draft.section,
            kind: "error",
            message:
              typeof accountError.message === "string"
                ? localizeAccountMessage(
                    locale,
                    accountError.message,
                    accountError.code,
                  )
                : locale === "vi"
                  ? "Không thể lưu mục hồ sơ."
                  : "The profile section could not be saved.",
            fieldErrors: localizeFieldErrors(locale, accountError.fieldErrors),
          };
          setFeedback(next);
          focusFirstError(next.fieldErrors);
          return false;
        }
        const outcome = profileMutationOutcomeSchema.safeParse(body);
        if (!outcome.success) throw new Error("PROFILE_RESPONSE_INVALID");
        setProfile(outcome.data.profile);
        const normalized = outcome.data.warnings.length > 0;
        const kind =
          outcome.data.conflictApplied || normalized ? "warning" : "success";
        const message = localizeAccountMessage(locale, outcome.data.message);
        setFeedback({ section: draft.section, kind, message });
        await load(false);
        return true;
      } catch {
        const message =
          locale === "vi"
            ? "Không thể lưu mục hồ sơ."
            : "The profile section could not be saved.";
        setFeedback({ section: draft.section, kind: "error", message });
        return false;
      } finally {
        savingRef.current = null;
        setSavingSection(null);
      }
    },
    [csrfProof, focusFirstError, load, locale, profile],
  );

  return {
    profile,
    loading,
    loadError,
    savingSection,
    feedback,
    save,
    reload: () => load(true),
  };
}
