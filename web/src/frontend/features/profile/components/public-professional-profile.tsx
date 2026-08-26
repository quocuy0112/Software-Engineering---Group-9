import type { ReactNode } from "react";
import {
  BriefcaseBusiness,
  GraduationCap,
  Link2,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { EligibleContext, SafeParticipant } from "@/shared/contracts/messaging/common";
import type { DiscoverableProfile } from "@/shared/contracts/profile-discovery";
import { ProfileMessageAction } from "./profile-message-action";

type PublicProfileProps = {
  participant: SafeParticipant;
  profile: { headline: string | null; summary: string | null; location: string | null } | null;
  contexts: EligibleContext[];
  csrfProof: string;
  canMessage?: boolean;
  visibleSections?: DiscoverableProfile["sections"];
};

export function PublicProfessionalProfile({
  participant,
  profile,
  contexts,
  csrfProof,
  canMessage = true,
  visibleSections,
}: PublicProfileProps) {
  const empty =
    !profile?.summary &&
    !visibleSections?.skills?.length &&
    !visibleSections?.experience?.length &&
    !visibleSections?.education?.length &&
    !visibleSections?.links?.length;

  return (
    <main className="profile-page professional-profile-page public-profile-page">
      <header className="public-profile-hero">
        <div className="public-profile-hero__identity">
          <div className="public-profile-avatar" aria-hidden="true">
            {participant.image ? <img src={participant.image} alt="" /> : participant.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="workspace-kicker">PROFESSIONAL PROFILE</p>
            <h1 id="workspace-page-title">{participant.name}</h1>
            <p className={`public-profile-hero__headline${profile?.headline ? "" : " is-empty"}`}>
              {profile?.headline ?? "Professional profile"}
            </p>
            {profile?.location ? <p className="public-profile-hero__location"><MapPin aria-hidden="true" /> {profile.location}</p> : null}
          </div>
        </div>
        {canMessage ? <div className="public-profile-actions"><ProfileMessageAction csrfProof={csrfProof} participantId={participant.id} participantName={participant.name} contexts={contexts} /></div> : null}
      </header>

      <section className="public-profile-grid" aria-labelledby="professional-summary-title">
        {profile?.summary ? <article className="public-profile-card public-profile-card--summary"><span className="public-profile-card__icon"><Sparkles aria-hidden="true" /></span><div><p className="workspace-kicker">ABOUT</p><h2 id="professional-summary-title">Professional summary</h2><p>{profile.summary}</p></div></article> : null}
        {visibleSections?.skills?.length ? <ProfileList title="Skills" icon={<ShieldCheck aria-hidden="true" />} items={visibleSections.skills} /> : null}
        {visibleSections?.experience?.length ? <ProfileList title="Experience" icon={<BriefcaseBusiness aria-hidden="true" />} items={visibleSections.experience.map((item) => `${item.title} · ${item.company}`)} /> : null}
        {visibleSections?.education?.length ? <ProfileList title="Education" icon={<GraduationCap aria-hidden="true" />} items={visibleSections.education.map((item) => `${item.degree} · ${item.institution}`)} /> : null}
        {visibleSections?.links?.length ? <ProfileLinks links={visibleSections.links} /> : null}
        {empty ? <article className="public-profile-empty"><span><Sparkles aria-hidden="true" /></span><div><h2 id="professional-summary-title">Profile in progress</h2><p>This person has enabled profile discovery but has not added public professional details yet.</p></div></article> : null}
      </section>
    </main>
  );
}

function ProfileList({ title, icon, items }: { title: string; icon: ReactNode; items: string[] }) {
  return <article className="public-profile-card"><header><span className="public-profile-card__icon">{icon}</span><div><p className="workspace-kicker">PROFILE DETAILS</p><h2>{title}</h2></div></header><ul className={title === "Skills" ? "public-profile-skills" : "public-profile-list"}>{items.map((item) => <li key={item}>{item}</li>)}</ul></article>;
}

function ProfileLinks({ links }: { links: string[] }) {
  return <article className="public-profile-card"><header><span className="public-profile-card__icon"><Link2 aria-hidden="true" /></span><div><p className="workspace-kicker">PROFILE DETAILS</p><h2>Professional links</h2></div></header><ul className="public-profile-list">{links.map((link) => <li key={link}><a href={link} target="_blank" rel="noreferrer">{link}</a></li>)}</ul></article>;
}
