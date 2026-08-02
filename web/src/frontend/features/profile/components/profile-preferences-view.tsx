"use client";

import { useEffect, useRef } from "react";
import type { AccountPreferences } from "@/shared/contracts/account/preferences";
import { useAccountPreferences } from "../client/use-account-preferences";
import { AccountPreferencesForm } from "./account-preferences-form";
import { ProfileNavigation } from "./profile-navigation";
import {
  UnsavedChangesIndicator,
  useUnsavedChangesGuard,
} from "../client/unsaved-changes";

export function ProfilePreferencesView({
  initialPreferences,
  csrfProof,
}: {
  initialPreferences: AccountPreferences;
  csrfProof: string;
}) {
  const copy = {
    kicker: "YOUR EXPERIENCE",
    title: "Preferences",
    subtitle:
      "Keep timezone and notification settings consistent across every signed-in device.",
    panel: "ACCOUNT DEFAULTS",
    panelTitle: "Account preferences",
  };
  const state = useAccountPreferences(initialPreferences, csrfProof);
  useUnsavedChangesGuard(state.dirty);
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.feedback) feedbackRef.current?.focus();
  }, [state.feedback]);

  return (
    <div className="profile-page account-preferences-page">
      <header className="page-heading profile-heading">
        <div>
          <p className="workspace-kicker">{copy.kicker}</p>
          <h1 id="workspace-page-title">{copy.title}</h1>
          <p className="page-heading-copy">{copy.subtitle}</p>
        </div>
      </header>
      <ProfileNavigation active="preferences" />
      <section
        className="account-preferences-panel"
        aria-labelledby="preferences-form-title"
      >
        <div className="account-panel-heading">
          <div>
            <p className="panel-kicker">{copy.panel}</p>
            <h2 id="preferences-form-title">{copy.panelTitle}</h2>
            <UnsavedChangesIndicator dirty={state.dirty} />
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
