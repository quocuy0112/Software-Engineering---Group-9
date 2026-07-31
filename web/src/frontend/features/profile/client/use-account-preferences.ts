"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { accountErrorSchema } from "@/shared/contracts/account/common";
import {
  accountPreferencesMutationOutcomeSchema,
  type AccountPreferences,
} from "@/shared/contracts/account/preferences";

export type AccountPreferencesFeedback = {
  kind: "success" | "error";
  message: string;
};

export function useAccountPreferences(
  initialPreferences: AccountPreferences,
  csrfProof: string,
) {
  const [preferences, setPreferences] = useState(initialPreferences);
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
          ? parsed.data.message
          : "The preferences could not be saved.";
        setFeedback({ kind: "error", message });
        toast.error(message, { id: "account-preferences-feedback" });
        return false;
      }
      const parsed = accountPreferencesMutationOutcomeSchema.safeParse(body);
      if (!parsed.success) throw new Error("PREFERENCES_RESPONSE_INVALID");
      setPreferences(parsed.data.preferences);
      setFeedback({ kind: "success", message: parsed.data.message });
      toast.success(parsed.data.message, {
        id: "account-preferences-feedback",
      });
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

  return { preferences, feedback, saving, update, save };
}
