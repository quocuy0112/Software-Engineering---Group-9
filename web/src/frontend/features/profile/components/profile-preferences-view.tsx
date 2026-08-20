"use client";

import { useEffect, useRef, useState } from "react";
import type { AccountPreferences } from "@/shared/contracts/account/preferences";
import { useAccountPreferences } from "../client/use-account-preferences";
import { AccountPreferencesForm } from "./account-preferences-form";
import { ProfileNavigation } from "./profile-navigation";
import { PageHeader } from "@/frontend/components/layout/page-header";
import { Panel, StatusPill } from "@/frontend/components/ui/design-system";
import {
  UnsavedChangesIndicator,
  useUnsavedChangesGuard,
} from "../client/unsaved-changes";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";

export function ProfilePreferencesView({
  initialPreferences,
  csrfProof,
}: {
  initialPreferences: AccountPreferences;
  csrfProof: string;
}) {
  const locale = useWorkspaceLocale();
  const copy =
    locale === "vi"
      ? {
          kicker: "TRẢI NGHIỆM CỦA BẠN",
          title: "Tùy chọn",
          subtitle:
            "Giữ múi giờ và thông báo nhất quán trên mọi thiết bị đã đăng nhập.",
          panel: "MẶC ĐỊNH TÀI KHOẢN",
          panelTitle: "Tùy chọn tài khoản",
        }
      : {
          kicker: "YOUR EXPERIENCE",
          title: "Preferences",
          subtitle:
            "Keep timezone and notification settings consistent across every signed-in device.",
          panel: "ACCOUNT DEFAULTS",
          panelTitle: "Account preferences",
        };
  const state = useAccountPreferences(initialPreferences, csrfProof);
  const [isEditing, setIsEditing] = useState(false);
  useUnsavedChangesGuard(state.dirty && isEditing);
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.feedback) feedbackRef.current?.focus();
  }, [state.feedback]);

  const languageLabel =
    state.preferences.language === "vi" ? "Tiếng Việt" : "English";
  const editLabel = locale === "vi" ? "Chỉnh sửa tùy chọn" : "Edit preferences";
  const cancelLabel = locale === "vi" ? "Hủy" : "Cancel";

  return (
    <div className="profile-page account-preferences-page">
      <ProfileNavigation active="preferences" />
      <PageHeader
        className="profile-heading"
        eyebrow={copy.kicker}
        title={copy.title}
        titleId="workspace-page-title"
        subtitle={copy.subtitle}
        status={{
          label: locale === "vi" ? "Tự động lưu" : "Auto-save",
          tone: "success",
          pulsing: true,
        }}
      />
      <Panel
        as="section"
        className="account-preferences-panel"
        eyebrow={copy.panel}
        title={copy.panelTitle}
        titleId="preferences-form-title"
        rightSlot={
          !isEditing ? (
            <StatusPill
              label={locale === "vi" ? "Đã lưu" : "Saved"}
              tone="success"
            />
          ) : (
            <UnsavedChangesIndicator dirty={state.dirty} />
          )
        }
      >
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
        {!isEditing ? (
          <div className="account-preferences-summary">
            <div className="account-preference-summary-grid">
              <div className="account-preference-summary-item">
                <span>Interface language</span>
                <strong>{languageLabel}</strong>
              </div>
              <div className="account-preference-summary-item">
                <span>Timezone</span>
                <strong>{state.preferences.timezone}</strong>
              </div>
            </div>
            <div className="account-preference-notification-summary">
              <div>
                <span>Email notifications</span>
                <p>Choose which product updates should reach your inbox.</p>
              </div>
              <ul>
                <li
                  data-enabled={
                    state.preferences.emailNotifications.application_updates
                  }
                >
                  Application updates
                  <strong>
                    {state.preferences.emailNotifications.application_updates
                      ? "On"
                      : "Off"}
                  </strong>
                </li>
                <li
                  data-enabled={
                    state.preferences.emailNotifications.job_recommendations
                  }
                >
                  Job recommendations
                  <strong>
                    {state.preferences.emailNotifications.job_recommendations
                      ? "On"
                      : "Off"}
                  </strong>
                </li>
                <li data-enabled="true">
                  Account security
                  <strong>Always on</strong>
                </li>
              </ul>
            </div>
            <div className="account-preferences-actions">
              <button
                className="profile-section-edit-button"
                type="button"
                onClick={() => setIsEditing(true)}
              >
                <u>{editLabel} &#8594;</u>
              </button>
            </div>
          </div>
        ) : (
          <div className="account-preferences-editor">
            <AccountPreferencesForm
              preferences={state.preferences}
              saving={state.saving}
              onChange={state.update}
              onSave={async () => {
                const saved = await state.save();
                if (saved) setIsEditing(false);
                return saved;
              }}
            />
            <div className="account-preferences-actions">
              <button
                className="profile-section-secondary-button"
                type="button"
                onClick={() => {
                  state.discard();
                  setIsEditing(false);
                }}
              >
                {cancelLabel}
              </button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
