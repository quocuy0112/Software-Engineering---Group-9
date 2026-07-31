"use client";

import Link from "next/link";
import type { CandidateProfileContract } from "@/shared/contracts/account/profile";
import { Badge } from "@/frontend/components/ui/badge";
import { useProfileEditor } from "../client/use-profile-editor";
import { ProfileNavigation } from "./profile-navigation";
import { ProfileBasicsForm } from "./profile-basics-form";
import { ProfileSkillsForm } from "./profile-skills-form";
import { ProfileExperienceForm } from "./profile-experience-form";
import { ProfileEducationForm } from "./profile-education-form";
import { ProfileSocialLinksForm } from "./profile-social-links-form";
import { ProfileSaveFeedback } from "./profile-save-feedback";

type ProfileOverviewProps = {
  account: {
    name: string;
    email: string;
    memberSince: string;
    twoFactorEnabled: boolean;
  };
  initialProfile?: CandidateProfileContract;
  csrfProof?: string;
};

export function ProfileOverview({
  account,
  initialProfile,
  csrfProof = "",
}: ProfileOverviewProps) {
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
          <p className="workspace-kicker">YOUR SMART HIRE ACCOUNT</p>
          <h1 id="workspace-page-title">Profile</h1>
          <p className="page-heading-copy">
            Manage your account and keep your professional information current.
          </p>
        </div>

        <Badge
          className="page-heading-badge"
          tone={account.twoFactorEnabled ? "success" : "warning"}
        >
          {account.twoFactorEnabled ? "2FA enabled" : "2FA recommended"}
        </Badge>
      </header>

      <ProfileNavigation active="overview" />

      <section className="profile-overview-grid" aria-label="Profile overview">
        <article className="profile-account-card profile-card">
          <p className="panel-kicker">ACCOUNT DETAILS</p>
          <h2>{account.name}</h2>

          <dl className="profile-account-details">
            <div>
              <dt>Email address</dt>
              <dd>{account.email}</dd>
            </div>
            <div>
              <dt>Account status</dt>
              <dd>Active</dd>
            </div>
            <div>
              <dt>Member since</dt>
              <dd>{account.memberSince}</dd>
            </div>
          </dl>

          <div className="profile-account-actions">
            <Badge
              className="profile-status-pill"
              tone={account.twoFactorEnabled ? "success" : "warning"}
            >
              {account.twoFactorEnabled ? "2FA enabled" : "2FA recommended"}
            </Badge>

            <Link href="/profile/account">Manage account</Link>
          </div>
        </article>

        <article className="profile-card profile-security-card">
          <p className="panel-kicker">SECURITY</p>
          <h2>Keep your account protected</h2>
          <p>
            Manage your password, authenticator, backup codes, and active
            sessions from one secure place.
          </p>
          <Link className="profile-card-link" href="/profile/security">
            Open security settings
          </Link>
        </article>
      </section>

      <section
        className="profile-future-section"
        aria-labelledby="professional-profile-title"
      >
        <div className="profile-section-heading">
          <div>
            <p className="workspace-kicker">YOUR PROFESSIONAL STORY</p>
            <h2 id="professional-profile-title">Professional profile</h2>
          </div>

          <Badge tone="info">Revision {profile.revision}</Badge>
        </div>

        {profile.empty ? (
          <section
            className="professional-profile-empty"
            aria-labelledby="empty-title"
          >
            <p className="panel-kicker">READY WHEN YOU ARE</p>
            <h2 id="empty-title">
              Your professional profile is not filled yet
            </h2>
            <p>
              Start with a headline, then add only the structured information
              you want to keep for later candidate workflows.
            </p>
            <button
              type="button"
              onClick={() =>
                document.getElementById("profile-headline")?.focus()
              }
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
      </section>
    </div>
  );
}
