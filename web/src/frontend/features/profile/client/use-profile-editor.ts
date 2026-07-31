"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  candidateProfileSchema,
  profileMutationOutcomeSchema,
  type CandidateProfileContract,
  type ProfileSectionMutation,
} from "@/shared/contracts/account/profile";
import type { AccountError } from "@/shared/contracts/account/common";

type WithoutBaseRevision<T> = T extends unknown
  ? Omit<T, "baseRevision">
  : never;
export type ProfileSectionDraft = WithoutBaseRevision<ProfileSectionMutation>;

export type ProfileEditorFeedback = {
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
            kind: "error",
            message:
              typeof accountError.message === "string"
                ? accountError.message
                : "The profile section could not be saved.",
            fieldErrors: accountError.fieldErrors,
          };
          setFeedback(next);
          toast.error(next.message, { id: "professional-profile-save" });
          focusFirstError(next.fieldErrors);
          return false;
        }
        const outcome = profileMutationOutcomeSchema.safeParse(body);
        if (!outcome.success) throw new Error("PROFILE_RESPONSE_INVALID");
        setProfile(outcome.data.profile);
        const normalized = outcome.data.warnings.length > 0;
        const kind =
          outcome.data.conflictApplied || normalized ? "warning" : "success";
        const message = outcome.data.message;
        setFeedback({ kind, message });
        if (kind === "success") {
          toast.success(message, { id: "professional-profile-save" });
        } else {
          toast.warning(message, { id: "professional-profile-save" });
        }
        await load(false);
        return true;
      } catch {
        const message = "The profile section could not be saved.";
        setFeedback({ kind: "error", message });
        toast.error(message, { id: "professional-profile-save" });
        return false;
      } finally {
        savingRef.current = null;
        setSavingSection(null);
      }
    },
    [csrfProof, focusFirstError, load, profile],
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
