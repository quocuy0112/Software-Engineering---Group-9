"use client";

import type { CandidateProfileContract } from "@/shared/contracts/account/profile";
import { useProfileEditor } from "../client/use-profile-editor";
import { ProfileNavigation } from "./profile-navigation";
import { ProfileBasicsForm } from "./profile-basics-form";
import { ProfileSkillsForm } from "./profile-skills-form";
import { ProfileExperienceForm } from "./profile-experience-form";
import { ProfileEducationForm } from "./profile-education-form";
import { ProfileSocialLinksForm } from "./profile-social-links-form";
import { ProfileSaveFeedback } from "./profile-save-feedback";

export function ProfileOverview({
  initialProfile,
  csrfProof = "",
}: {
  initialProfile?: CandidateProfileContract;
  csrfProof?: string;
}) {
  const editor = useProfileEditor(initialProfile, csrfProof);

  if (editor.loading) {
    return (
      <div className="profile-page professional-profile-page">
        <p role="status" aria-label="Loading professional profile">
          Loading professional profile…
        </p>
      </div>
    );
  }
  if (editor.loadError || !editor.profile) {
    return (
      <div className="profile-page professional-profile-page">
        <p role="alert">Unable to load your professional profile.</p>
        <button type="button" onClick={editor.reload}>
          Try again
        </button>
      </div>
    );
  }

  const profile = editor.profile;
  return (
    <div className="profile-page professional-profile-page">
      <header className="page-heading profile-heading">
        <div>
          <p className="workspace-kicker">YOUR PROFESSIONAL STORY</p>
          <h1 id="workspace-page-title">Professional profile</h1>
          <p className="page-heading-copy">
            Keep your structured skills, experience, education, contact details,
            and professional links current.
          </p>
        </div>
        <span className="page-heading-badge">Revision {profile.revision}</span>
      </header>
      <ProfileNavigation active="overview" />

      {profile.empty ? (
        <section
          className="professional-profile-empty"
          aria-labelledby="empty-title"
        >
          <p className="panel-kicker">READY WHEN YOU ARE</p>
          <h2 id="empty-title">Your professional profile is not filled yet</h2>
          <p>
            Start with a headline, then add only the structured information you
            want to keep for later candidate workflows.
          </p>
          <button
            type="button"
            onClick={() => document.getElementById("profile-headline")?.focus()}
          >
            Start editing
          </button>
        </section>
      ) : null}

      <ProfileSaveFeedback feedback={editor.feedback} />
      <div className="professional-profile-sections">
        <ProfileBasicsForm
          profile={profile}
          saving={editor.savingSection === "basics"}
          feedback={editor.feedback}
          onSave={editor.save}
        />
        <ProfileSkillsForm
          profile={profile}
          saving={editor.savingSection === "skills"}
          onSave={editor.save}
        />
        <ProfileExperienceForm
          profile={profile}
          saving={editor.savingSection === "experience"}
          onSave={editor.save}
        />
        <ProfileEducationForm
          profile={profile}
          saving={editor.savingSection === "education"}
          onSave={editor.save}
        />
        <ProfileSocialLinksForm
          profile={profile}
          saving={editor.savingSection === "socialLinks"}
          onSave={editor.save}
        />
      </div>
    </div>
  );
}
