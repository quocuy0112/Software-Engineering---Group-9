"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import styles from "./company-team-screen.module.css";

type Props = {
  companyId?: string;
  members: Array<{
    id: string;
    role: string;
    status: string;
    user: { name: string; email: string };
  }>;
  invitations: Array<{
    id: string;
    normalizedEmail: string;
    role: string;
    expiresAt: Date;
  }>;
  activities?: Array<{
    id: string;
    kind: string;
    targetEmail: string;
    role: string | null;
    occurredAt: Date;
    actor: { name: string; email: string } | null;
  }>;
};
const roleLabel = (role: string) =>
  role === "HR_MANAGER"
    ? "HR Manager"
    : role === "RECRUITER"
      ? "Recruiter"
      : "Owner";
const statusLabel = (status: string) =>
  status.charAt(0) + status.slice(1).toLowerCase();
const initials = (name: string) =>
  name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";
const activityLabel = (kind: string) =>
  ({
    INVITED: "invited",
    ACCEPTED: "accepted",
    DECLINED: "declined",
    REVOKED: "revoked",
    ROLE_CHANGED: "changed the role of",
    SUSPENDED: "suspended",
    RESTORED: "restored",
    REMOVED: "removed",
  })[kind] ?? kind.toLowerCase();
const invitationErrorMessage = (code?: string) => {
  switch (code) {
    case "INVITATION_EXISTS":
      return "This email already has a pending invitation. Revoke it before sending a new one.";
    case "MEMBERSHIP_EXISTS":
      return "This account is already a member of your company.";
    case "RECIPIENT_UNAVAILABLE":
      return "No active SmartHire account is available for this email.";
    default:
      return "Unable to send this invitation. Please try again.";
  }
};

export function CompanyTeamScreen({
  companyId,
  members,
  invitations,
  activities = [],
}: Props) {
  const csrf = useCsrfProof();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("RECRUITER");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const companyQuery = companyId
    ? `?companyId=${encodeURIComponent(companyId)}`
    : "";

  async function invite(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/recruiter/company/team/invitations${companyQuery}`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": csrf },
          body: JSON.stringify({ email, role }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        code?: string;
        message?: string;
      };
      if (!response.ok) throw new Error(invitationErrorMessage(payload.code));
      setEmail("");
      toast.success("Invitation queued for delivery", {
        description:
          "The recipient can review and respond from their SmartHire email.",
      });
      router.refresh();
    } catch (error) {
      toast.error("Invitation was not sent", {
        description:
          error instanceof Error
            ? error.message
            : "Unable to send this invitation. Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function command(id: string, action: string, nextRole?: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/recruiter/company/team/memberships/${id}${companyQuery}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-csrf-token": csrf },
          body: JSON.stringify({
            action,
            ...(nextRole ? { role: nextRole } : {}),
          }),
        },
      );
      if (!response.ok) throw new Error("Unable to update this member.");
      setMessage("Member access updated.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update this member.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (
      !window.confirm(
        "Revoke this pending invitation? The recipient will no longer be able to join.",
      )
    )
      return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/recruiter/company/team/invitations/${id}/revoke${companyQuery}`,
        { method: "POST", headers: { "x-csrf-token": csrf } },
      );
      if (!response.ok) throw new Error("Unable to revoke this invitation.");
      setMessage("Invitation revoked.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to revoke this invitation.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Company settings / Team</p>
          <h1>Build your hiring team</h1>
          <p>
            Invite trusted colleagues and manage their access to this company.
          </p>
        </div>
        <div className={styles.memberCount}>
          <strong>{members.length}</strong>
          <span>team members</span>
        </div>
      </header>
      <p className={styles.notice} role="status" aria-live="polite">
        {message}
      </p>
      <section className={styles.inviteCard} aria-labelledby="invite-title">
        <div className={styles.cardTitle}>
          <span className={styles.icon} aria-hidden="true">
            👤
          </span>
          <div>
            <h2 id="invite-title">
              <b>Invite a teammate</b>
            </h2>
            <p>They must already have a SmartHire account to accept.</p>
          </div>
        </div>
        <form className={styles.inviteForm} onSubmit={invite}>
          <label className={styles.field}>
            <span>Work email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              required
              type="email"
              autoComplete="email"
            />
          </label>
          <label className={styles.field}>
            <span>Role</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="RECRUITER">Recruiter</option>
              <option value="HR_MANAGER">HR Manager</option>
            </select>
          </label>
          <button
            className={styles.primaryButton}
            disabled={busy}
            type="submit"
          >
            {busy ? "Sending…" : "Send invitation"}
          </button>
        </form>
      </section>
      <section className={styles.section} aria-labelledby="members-title">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="members-title">
              <b>Team members</b>
            </h2>
            <p>Manage roles and access for your company.</p>
          </div>
          <span className={styles.totalColor}>{members.length} total</span>
        </div>
        <div className={styles.memberList}>
          {members.map((member) => {
            const managed = member.role !== "OWNER";
            const nextRole =
              member.role === "RECRUITER" ? "HR_MANAGER" : "RECRUITER";
            return (
              <article className={styles.memberRow} key={member.id}>
                <span className={styles.avatar} aria-hidden="true">
                  {initials(member.user.name)}
                </span>
                <div className={styles.memberIdentity}>
                  <strong>{member.user.name}</strong>
                  <span>{member.user.email}</span>
                </div>
                <span className={styles.roleBadge}>
                  {roleLabel(member.role)}
                </span>
                <span
                  className={`${styles.statusBadge} ${member.status === "ACTIVE" ? styles.active : member.status === "SUSPENDED" ? styles.suspended : styles.removed}`}
                >
                  {statusLabel(member.status)}
                </span>
                {managed ? (
                  <div className={styles.actions}>
                    <button
                      className={styles.textButton}
                      disabled={busy || member.status === "REMOVED"}
                      type="button"
                      onClick={() => void command(member.id, "role", nextRole)}
                    >
                      Make {roleLabel(nextRole)}
                    </button>
                    <button
                      className={styles.textButton}
                      disabled={busy || member.status === "REMOVED"}
                      type="button"
                      onClick={() =>
                        void command(
                          member.id,
                          member.status === "SUSPENDED" ? "restore" : "suspend",
                        )
                      }
                    >
                      {member.status === "SUSPENDED" ? "Restore" : "Suspend"}
                    </button>
                    <button
                      className={styles.removeButton}
                      disabled={busy || member.status === "REMOVED"}
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Remove ${member.user.name} from the company?`,
                          )
                        )
                          void command(member.id, "remove");
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <span className={styles.ownerNote}>Primary owner</span>
                )}
              </article>
            );
          })}
        </div>
      </section>
      <section
        className={styles.section}
        aria-labelledby="pending-invitations-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="pending-invitations-title">
              <b>Pending invitations</b>
            </h2>
            <p>People who have not yet joined your company.</p>
          </div>
          <span className={styles.pendingColor}>
            {invitations.length} pending
          </span>
        </div>
        {invitations.length ? (
          <div className={styles.invitationList}>
            {invitations.map((invitation) => (
              <article className={styles.invitationRow} key={invitation.id}>
                <span className={styles.pendingAvatar} aria-hidden="true">
                  ✉
                </span>
                <div>
                  <strong>{invitation.normalizedEmail}</strong>
                  <span>
                    Invited as {roleLabel(invitation.role)} · expires{" "}
                    {new Date(invitation.expiresAt).toLocaleDateString()}
                  </span>
                </div>
                <button
                  className={styles.removeButton}
                  disabled={busy}
                  type="button"
                  onClick={() => void revoke(invitation.id)}
                >
                  Revoke
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <span aria-hidden="true">✦</span>
            <div>
              <strong>No pending invitations</strong>
              <p>Use the form above to invite your first teammate.</p>
            </div>
          </div>
        )}
      </section>
      <section className={styles.section} aria-labelledby="activity-title">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="activity-title">
              <b>Team activity</b>
            </h2>
            <p>A recent, immutable record of team access changes.</p>
          </div>
          <span className={styles.recentColor}>{activities.length} recent</span>
        </div>
        {activities.length ? (
          <ol className={styles.invitationList}>
            {activities.map((activity) => (
              <li className={styles.invitationRow} key={activity.id}>
                <span className={styles.pendingAvatar} aria-hidden="true">
                  &#33;
                </span>
                <div>
                  <strong>
                    {activity.actor?.name ?? "System"}{" "}
                    {activityLabel(activity.kind)} {activity.targetEmail}
                  </strong>
                  <span>
                    {activity.role
                      ? `Role: ${roleLabel(activity.role)} · `
                      : ""}
                    {new Date(activity.occurredAt).toLocaleString()}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className={styles.emptyState}>
            <span aria-hidden="true">&#9940;</span>
            <div>
              <strong>No activity yet</strong>
              <p>Invitation and member-access actions will appear here.</p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
