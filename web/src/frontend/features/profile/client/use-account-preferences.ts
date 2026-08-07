"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { accountErrorSchema } from "@/shared/contracts/account/common";
import {
  accountPreferencesMutationOutcomeSchema,
  type AccountPreferences,
} from "@/shared/contracts/account/preferences";
import { localizeAccountMessage } from "./localized-account-feedback";
import {
  useSetWorkspaceLocale,
  useWorkspaceLocale,
} from "../../dashboard/client/workspace-locale";

export type AccountPreferencesFeedback = {
  kind: "success" | "error";
  message: string;
};

export function useAccountPreferences(
  initialPreferences: AccountPreferences,
  csrfProof: string,
) {
  const router = useRouter();
  const currentLocale = useWorkspaceLocale();
  const setWorkspaceLocale = useSetWorkspaceLocale();
  const [preferences, setPreferences] = useState(initialPreferences);
  const [savedPreferences, setSavedPreferences] = useState(initialPreferences);
  const [feedback, setFeedback] = useState<AccountPreferencesFeedback | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const active = useRef(false);

  const update = (next: AccountPreferences) => {
    setPreferences(next);
    setFeedback(null);
  };

  const save = async (): Promise<boolean> => {
    if (active.current) return false;
    active.current = true;
    setSaving(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/account/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfProof,
        },
        body: JSON.stringify({
          language: preferences.language,
          timezone: preferences.timezone,
          emailNotifications: preferences.emailNotifications,
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const parsed = accountErrorSchema.safeParse(body);
        const message = parsed.success
          ? localizeAccountMessage(
              preferences.language,
              parsed.data.message,
              parsed.data.code,
            )
          : preferences.language === "vi"
            ? "Không thể lưu tùy chọn. Hãy thử lại."
            : "The preferences could not be saved.";
        setFeedback({ kind: "error", message });
        toast.error(message, { id: "account-preferences-feedback" });
        return false;
      }
      const parsed = accountPreferencesMutationOutcomeSchema.safeParse(body);
      if (!parsed.success) throw new Error("PREFERENCES_RESPONSE_INVALID");
      const saved = parsed.data.preferences;
      setPreferences(saved);
      setSavedPreferences(saved);
      setWorkspaceLocale(saved.language);
      const message = localizeAccountMessage(
        saved.language,
        parsed.data.message,
      );
      setFeedback({ kind: "success", message });
      toast.success(message, {
        id: "account-preferences-feedback",
      });
      router.refresh();
      return true;
    } catch {
      const message =
        preferences.language === "vi"
          ? "Không thể lưu tùy chọn. Hãy thử lại."
          : "The preferences could not be saved.";
      setFeedback({ kind: "error", message });
      toast.error(message, { id: "account-preferences-feedback" });
      return false;
    } finally {
      active.current = false;
      setSaving(false);
    }
  };

  const dirty =
    JSON.stringify(preferences) !== JSON.stringify(savedPreferences);

  return {
    preferences,
    feedback,
    saving,
    dirty,
    update,
    save,
    currentLocale,
  };
}
