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

export type AccountPreferencesFeedback = {
  kind: "success" | "error";
  message: string;
};

function normalizeEnglishPreferences(
  preferences: AccountPreferences,
): AccountPreferences {
  return { ...preferences, language: "en" };
}

export function useAccountPreferences(
  initialPreferences: AccountPreferences,
  csrfProof: string,
) {
  const router = useRouter();
  const [preferences, setPreferences] = useState(() =>
    normalizeEnglishPreferences(initialPreferences),
  );
  const [savedPreferences, setSavedPreferences] = useState(() =>
    normalizeEnglishPreferences(initialPreferences),
  );
  const [feedback, setFeedback] = useState<AccountPreferencesFeedback | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const active = useRef(false);

  const update = (next: AccountPreferences) => {
    setPreferences(normalizeEnglishPreferences(next));
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
          language: "en",
          timezone: preferences.timezone,
          emailNotifications: preferences.emailNotifications,
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const parsed = accountErrorSchema.safeParse(body);
        const message = parsed.success
          ? localizeAccountMessage("en", parsed.data.message, parsed.data.code)
          : "The preferences could not be saved.";
        setFeedback({ kind: "error", message });
        toast.error(message, { id: "account-preferences-feedback" });
        return false;
      }
      const parsed = accountPreferencesMutationOutcomeSchema.safeParse(body);
      if (!parsed.success) throw new Error("PREFERENCES_RESPONSE_INVALID");
      const normalizedPreferences = normalizeEnglishPreferences(
        parsed.data.preferences,
      );
      setPreferences(normalizedPreferences);
      setSavedPreferences(normalizedPreferences);
      const message = localizeAccountMessage("en", parsed.data.message);
      setFeedback({ kind: "success", message });
      toast.success(message, {
        id: "account-preferences-feedback",
      });
      router.refresh();
      return true;
    } catch {
      const message = "The preferences could not be saved.";
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

  return { preferences, feedback, saving, dirty, update, save };
}
