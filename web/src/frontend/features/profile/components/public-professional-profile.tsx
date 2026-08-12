import type { EligibleContext, SafeParticipant } from "@/shared/contracts/messaging/common";
import { ProfileMessageAction } from "./profile-message-action";

export function PublicProfessionalProfile({
  participant,
  profile,
  contexts,
  csrfProof,
}: {
  participant: SafeParticipant;
  profile: { headline: string | null; summary: string | null; location: string | null } | null;
  contexts: EligibleContext[];
  csrfProof: string;
}) {
  return (
    <main className="profile-page professional-profile-page">
      <header className="page-heading profile-heading">
        <div>
          <p className="workspace-kicker">PROFESSIONAL PROFILE</p>
          <h1 id="workspace-page-title">{participant.name}</h1>
          {profile?.headline ? <p>{profile.headline}</p> : null}
          {profile?.location ? <p>{profile.location}</p> : null}
        </div>
        <ProfileMessageAction
          csrfProof={csrfProof}
          participantId={participant.id}
          participantName={participant.name}
          contexts={contexts}
        />
      </header>
      <section aria-labelledby="professional-summary-title">
        <h2 id="professional-summary-title">Professional summary</h2>
        <p>{profile?.summary ?? "No public summary is available."}</p>
      </section>
    </main>
  );
}
