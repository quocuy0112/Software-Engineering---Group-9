"use client";

import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { CandidateProfileContract } from "@/shared/contracts/account/profile";
import type { ProfileEditorFeedback, ProfileSectionDraft } from "../client/use-profile-editor";

type VisibilitySection = NonNullable<CandidateProfileContract["visibility"]>["candidateSections"][number];
const sections: Array<[VisibilitySection, string, string]> = [["avatar", "Avatar", "Your profile photo"], ["headline", "Headline", "Your professional title"], ["summary", "Summary", "Your introduction"], ["location", "Location", "City or region"], ["skills", "Skills", "Your selected skills"], ["experience", "Experience", "Role and company"], ["education", "Education", "School and degree"], ["links", "Professional links", "Portfolio and social links"]];

export function ProfileVisibilityForm({ profile, saving, feedback, onSave }: { profile: CandidateProfileContract; saving: boolean; feedback: ProfileEditorFeedback | null; onSave: (draft: ProfileSectionDraft) => Promise<boolean>; }) {
  const visibility = profile.visibility ?? { discoverableByExactId: false, candidateSections: [], recruiterSections: [] };
  const [discoverable, setDiscoverable] = useState(visibility.discoverableByExactId);
  const [candidateSections, setCandidateSections] = useState<VisibilitySection[]>(visibility.candidateSections);
  const [recruiterSections, setRecruiterSections] = useState<VisibilitySection[]>(visibility.recruiterSections);
  useEffect(() => { setDiscoverable(visibility.discoverableByExactId); setCandidateSections(visibility.candidateSections); setRecruiterSections(visibility.recruiterSections); }, [profile.revision]);
  const toggle = (value: VisibilitySection, audience: "candidate" | "recruiter") => { const current = audience === "candidate" ? candidateSections : recruiterSections; const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value]; audience === "candidate" ? setCandidateSections(next) : setRecruiterSections(next); };
  const handleSave = async () => {
    const saved = await onSave({ section: "visibility", visibility: { discoverableByExactId: discoverable, candidateSections, recruiterSections } });
    if (saved) toast.success("Privacy settings saved.", { id: "profile-visibility" });
    else toast.error("Privacy settings could not be saved.", { id: "profile-visibility" });
  };
  return <section className="profile-compact-section profile-visibility" aria-labelledby="profile-visibility-title"><header className="profile-compact-header"><div><p className="workspace-kicker">PRIVACY CONTROLS</p><h2 id="profile-visibility-title">Who can view your profile</h2><p>Choose only the professional details you want to share. Contact details, CV files, applications, scores, and messages remain private.</p></div></header><div className="profile-visibility__discovery" data-enabled={discoverable}><span aria-hidden="true">{discoverable ? <Eye /> : <EyeOff />}</span><div><strong>Discoverable by exact ID</strong><p>Other candidates must know your full account ID. There is no name, email, or directory search.</p></div><label className="profile-visibility__switch"><input type="checkbox" checked={discoverable} onChange={(event) => setDiscoverable(event.target.checked)} /><span aria-hidden="true" /><b>{discoverable ? "On" : "Off"}</b></label></div><div className="profile-visibility__audiences"><Audience title="Candidates" description="Shown only to people who search your exact ID." selected={candidateSections} audience="candidate" onToggle={toggle} /><Audience title="Recruiters after you apply" description="Current information shown in addition to your immutable submitted application." selected={recruiterSections} audience="recruiter" onToggle={toggle} /></div><footer className="profile-visibility__footer"><span><ShieldCheck aria-hidden="true" /> Changes take effect for future views.</span><button type="button" disabled={saving} onClick={() => void handleSave()}>{saving ? "Saving…" : "Save privacy settings"}</button></footer>{feedback ? <p className="profile-visibility__feedback" role={feedback.kind === "error" ? "alert" : "status"}>{feedback.message}</p> : null}</section>;
}

function Audience({ title, description, selected, audience, onToggle }: { title: string; description: string; selected: VisibilitySection[]; audience: "candidate" | "recruiter"; onToggle: (value: VisibilitySection, audience: "candidate" | "recruiter") => void }) { return <fieldset className="profile-visibility__audience"><legend>{title}</legend><p>{description}</p><div>{sections.map(([value, label, hint]) => <label key={value}><input type="checkbox" checked={selected.includes(value)} onChange={() => onToggle(value, audience)} /><span><strong>{label}</strong><small>{hint}</small></span></label>)}</div></fieldset>; }
