"use client";

import { PageHeader } from "@/frontend/components/layout/page-header";
import type { CandidateProfileContract } from "@/shared/contracts/account/profile";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import { useProfileEditor } from "../client/use-profile-editor";
import { profileAboutCopy } from "../i18n/profile-about-copy";
import { ProfileAboutForm } from "./profile-about-form";
import { ProfileNavigation } from "./profile-navigation";

export function ProfileAboutView({
  initialProfile,
  csrfProof,
}: {
  initialProfile?: CandidateProfileContract;
  csrfProof: string;
}) {
  const locale = useWorkspaceLocale();
  const copy = profileAboutCopy(locale);
  const editor = useProfileEditor(initialProfile, csrfProof);

  if (editor.loading) {
    return (
      <div className="candidate-profile-page profile-about-page">
        <ProfileNavigation active="about" />
        <p role="status">{copy.loading}</p>
      </div>
    );
  }

  if (editor.loadError || !editor.profile) {
    return (
      <div className="candidate-profile-page profile-about-page">
        <ProfileNavigation active="about" />
        <p role="alert">
          {copy.loadError}
        </p>
        <button type="button" onClick={editor.reload}>
          {copy.retry}
        </button>
      </div>
    );
  }

  return (
    <div className="candidate-profile-page profile-about-page">
      <ProfileNavigation active="about" />
      <PageHeader
        className="candidate-profile-page__header"
        eyebrow={copy.pageKicker}
        title={copy.pageTitle}
        titleId="workspace-page-title"
        subtitle={copy.pageSubtitle}
        status={{
          label: copy.autoSave,
          tone: "success",
          pulsing: true,
        }}
      />
      <ProfileAboutForm
        profile={editor.profile}
        saving={editor.savingSection === "about"}
        feedback={editor.feedback?.section === "about" ? editor.feedback : null}
        onSave={editor.save}
      />
    </div>
  );
}
