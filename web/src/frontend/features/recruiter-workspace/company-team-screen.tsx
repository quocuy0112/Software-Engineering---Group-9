"use client";

import { useState, type FormEvent } from "react";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";

type Props = {
  members: Array<{ id: string; role: string; status: string; user: { name: string; email: string } }>;
  invitations: Array<{ id: string; normalizedEmail: string; role: string; expiresAt: Date }>;
};

export function CompanyTeamScreen({ members, invitations }: Props) {
  const csrf = useCsrfProof();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("RECRUITER");
  const [message, setMessage] = useState("");
  const [acceptanceLink, setAcceptanceLink] = useState("");

  async function invite(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/recruiter/company/team/invitations", { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": csrf }, body: JSON.stringify({ email, role }) });
    const payload = (await response.json().catch(() => ({}))) as { acceptanceToken?: string };
    setMessage(response.ok ? "Invitation created. Send the one-time link to the recipient." : "Unable to invite this account.");
    if (response.ok) {
      setEmail("");
      setAcceptanceLink(`${window.location.origin}/recruiter/company-invitation?token=${encodeURIComponent(payload.acceptanceToken ?? "")}`);
    }
  }

  async function command(id: string, action: string, nextRole?: string) {
    const response = await fetch(`/api/recruiter/company/team/memberships/${id}`, { method: "PATCH", headers: { "content-type": "application/json", "x-csrf-token": csrf }, body: JSON.stringify({ action, ...(nextRole ? { role: nextRole } : {}) }) });
    setMessage(response.ok ? "Member updated. Refresh the page to see changes." : "Unable to update member.");
  }

  async function revoke(id: string) {
    if (!window.confirm("Revoke this pending invitation?")) return;
    const response = await fetch(`/api/recruiter/company/team/invitations/${id}/revoke`, { method: "POST", headers: { "x-csrf-token": csrf } });
    setMessage(response.ok ? "Invitation revoked. Refresh the page to see changes." : "Unable to revoke invitation.");
  }

  return <main>
    <h1>Team members</h1>
    <form onSubmit={invite}>
      <label>Email <input value={email} onChange={(event) => setEmail(event.target.value)} required type="email" /></label>
      <label>Role <select value={role} onChange={(event) => setRole(event.target.value)}><option value="RECRUITER">Recruiter</option><option value="HR_MANAGER">HR Manager</option></select></label>
      <button>Invite member</button>
    </form>
    <p role="status" aria-live="polite">{message}</p>
    {acceptanceLink ? <p><label htmlFor="company-invitation-link">One-time invitation link</label><input id="company-invitation-link" readOnly value={acceptanceLink} /></p> : null}
    <section aria-labelledby="pending-invitations-title">
      <h2 id="pending-invitations-title">Pending invitations</h2>
      {invitations.length ? <ul>{invitations.map((invitation) => <li key={invitation.id}>{invitation.normalizedEmail} — {invitation.role} — pending until {new Date(invitation.expiresAt).toLocaleDateString()} <button type="button" onClick={() => void revoke(invitation.id)}>Revoke invitation</button></li>)}</ul> : <p>No pending invitations.</p>}
    </section>
    <ul>{members.map((member) => <li key={member.id}>{member.user.name} ({member.user.email}) — {member.role} — {member.status} {member.role !== "OWNER" ? <><button type="button" onClick={() => void command(member.id, "role", member.role === "RECRUITER" ? "HR_MANAGER" : "RECRUITER")}>Change role</button><button type="button" onClick={() => void command(member.id, member.status === "SUSPENDED" ? "restore" : "suspend")}>{member.status === "SUSPENDED" ? "Restore" : "Suspend"}</button><button type="button" onClick={() => { if (window.confirm("Remove this member from the company?")) void command(member.id, "remove"); }}>Remove</button></> : null}</li>)}</ul>
  </main>;
}
