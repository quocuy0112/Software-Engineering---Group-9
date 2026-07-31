"use client";

import { useEffect, useRef } from "react";
import type { AccountPreferences } from "@/shared/contracts/account/preferences";
import { useAccountPreferences } from "../client/use-account-preferences";
import { AccountPreferencesForm } from "./account-preferences-form";
import { ProfileNavigation } from "./profile-navigation";

export function ProfilePreferencesView({
  initialPreferences,
  csrfProof,
}: {
  initialPreferences: AccountPreferences;
  csrfProof: string;
}) {
  const state = useAccountPreferences(initialPreferences, csrfProof);
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.feedback) feedbackRef.current?.focus();
  }, [state.feedback]);

  return (
    <div className="profile-page account-preferences-page">
      <header className="page-heading profile-heading">
        <div>
          <p className="workspace-kicker">YOUR EXPERIENCE</p>
          <h1 id="workspace-page-title">Preferences</h1>
          <p className="page-heading-copy">
            Keep language, timezone, and permitted email choices consistent
            across every signed-in device.
          </p>
        </div>
      </header>
      <ProfileNavigation active="preferences" />
      <section
        className="account-preferences-panel"
        aria-labelledby="preferences-form-title"
      >
        <div className="account-panel-heading">
          <div>
            <p className="panel-kicker">ACCOUNT DEFAULTS</p>
            <h2 id="preferences-form-title">Account preferences</h2>
          </div>
        </div>
        <div
          ref={feedbackRef}
          className="account-preferences-feedback"
          role={
            state.feedback
              ? state.feedback.kind === "error"
                ? "alert"
                : "status"
              : undefined
          }
          aria-live="polite"
          aria-atomic="true"
          tabIndex={state.feedback ? -1 : undefined}
          data-feedback-kind={state.feedback?.kind}
        >
          {state.feedback?.message}
        </div>
        <AccountPreferencesForm
          preferences={state.preferences}
          saving={state.saving}
          onChange={state.update}
          onSave={state.save}
        />
      </section>
    </div>
  );
}
