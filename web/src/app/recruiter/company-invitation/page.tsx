"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import styles from "./company-invitation.module.css";

type Invitation = {
  companyName: string;
  role: "HR_MANAGER" | "RECRUITER";
  expiresAt: string;
};

export default function CompanyInvitationPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const invitationId = searchParams.get("invitationId") ?? "";
  const reference = token ? { token } : invitationId ? { invitationId } : null;
  const csrf = useCsrfProof();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [state, setState] = useState<
    "loading" | "ready" | "accepted" | "declined" | "unavailable"
  >(reference ? "loading" : "unavailable");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token && !invitationId) return;
    const query = token
      ? `token=${encodeURIComponent(token)}`
      : `invitationId=${encodeURIComponent(invitationId)}`;
    void fetch(`/api/recruiter/company/team/invitations/accept?${query}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        setInvitation((await response.json()) as Invitation);
        setState("ready");
      })
      .catch(() => setState("unavailable"));
  }, [invitationId, token]);

  async function decide(decision: "accept" | "decline") {
    if (
      decision === "decline" &&
      !window.confirm("Decline this company invitation? This cannot be undone.")
    )
      return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/recruiter/company/team/invitations/${decision === "accept" ? "accept" : "decline"}`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": csrf },
          body: JSON.stringify(reference),
        },
      );
      if (!response.ok) throw new Error("unavailable");
      setState(decision === "accept" ? "accepted" : "declined");
    } catch {
      setState("unavailable");
    } finally {
      setBusy(false);
    }
  }

  const role = invitation?.role === "HR_MANAGER" ? "HR Manager" : "Recruiter";
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-live="polite">
        <span className={styles.icon} aria-hidden="true">
          ✦
        </span>
        {state === "loading" ? (
          <>
            <h1>Checking your invitation</h1>
            <p>
              We are verifying that this invitation belongs to your signed-in
              account.
            </p>
          </>
        ) : null}
        {state === "ready" && invitation ? (
          <>
            <p className={styles.eyebrow}>SmartHire team invitation</p>
            <h1>Join {invitation.companyName}</h1>
            <p>
              You were invited to join as <strong>{role}</strong>. Choose
              whether to join this hiring team.
            </p>
            <p className={styles.expiry}>
              This invitation expires{" "}
              {new Date(invitation.expiresAt).toLocaleString()}.
            </p>
            <div className={styles.actions}>
              <button
                className={styles.accept}
                disabled={busy}
                onClick={() => void decide("accept")}
              >
                Accept invitation
              </button>
              <button
                className={styles.decline}
                disabled={busy}
                onClick={() => void decide("decline")}
              >
                Decline
              </button>
            </div>
          </>
        ) : null}
        {state === "accepted" ? (
          <>
            <h1>You joined the company</h1>
            <p>
              Your company access is now active. You can continue to the
              recruiter workspace.
            </p>
          </>
        ) : null}
        {state === "declined" ? (
          <>
            <h1>Invitation declined</h1>
            <p>
              The Owner has been notified. You have not been added to the
              company.
            </p>
          </>
        ) : null}
        {state === "unavailable" ? (
          <>
            <h1>Invitation unavailable</h1>
            <p>
              This link may be expired, revoked, already handled, or assigned to
              another account.
            </p>
          </>
        ) : null}
      </section>
    </main>
  );
}
