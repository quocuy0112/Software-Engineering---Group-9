"use client";

import { useEffect, useState, type FormEvent } from "react";

type Item = {
  id: string;
  submittedCompanyName: string;
  normalizedTaxIdentifier: string;
  requestedRole: string;
  state: string;
  resubmissionCount: number;
  createdAt: string;
};

export function EmployerVerificationPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [message, setMessage] = useState("");
  const [busyRequestId, setBusyRequestId] = useState<string>();

  async function load() {
    const response = await fetch("/api/employer-verifications", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (response.ok) setItems((await response.json()).data);
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/employer-verifications", {
      cache: "no-store",
      credentials: "same-origin",
    }).then(async (response) => {
      if (active && response.ok) setItems((await response.json()).data);
    });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const response = await fetch("/api/employer-verifications", {
      method: "POST",
      body: new FormData(form),
      credentials: "same-origin",
    });
    setMessage(
      response.ok
        ? "Verification request received."
        : "The request could not be accepted.",
    );
    if (response.ok) {
      form.reset();
      await load();
    }
  }

  async function cancel(requestId: string) {
    setBusyRequestId(requestId);
    const response = await fetch(
      `/api/employer-verifications/${encodeURIComponent(requestId)}/cancel`,
      { method: "POST", credentials: "same-origin" },
    );
    setMessage(
      response.ok ? "Verification request cancelled." : "Cancellation failed.",
    );
    await load();
    setBusyRequestId(undefined);
  }

  async function resubmit(
    requestId: string,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setBusyRequestId(requestId);
    const response = await fetch(
      `/api/employer-verifications/${encodeURIComponent(requestId)}/resubmit`,
      {
        method: "POST",
        body: new FormData(event.currentTarget),
        credentials: "same-origin",
      },
    );
    setMessage(
      response.ok
        ? "Replacement evidence received."
        : "Replacement evidence could not be accepted.",
    );
    if (response.ok) event.currentTarget.reset();
    await load();
    setBusyRequestId(undefined);
  }

  return (
    <main className="mx-auto grid max-w-3xl gap-8 p-6">
      <section>
        <h1 className="text-3xl font-semibold">Recruiter application</h1>
        <p>
          Apply to become a recruiter by submitting one PDF, PNG, or JPEG
          business license from 1 byte through 5 MB. Documents remain private
          and are safety checked before review.
        </p>
        {message && <p role="status">{message}</p>}
        <form onSubmit={submit} className="grid gap-4">
          <input type="hidden" name="requestedRole" value="RECRUITER" />
          <label>
            Legal company name
            <input name="companyName" required maxLength={240} />
          </label>
          <label>
            Vietnamese tax identifier
            <input
              name="taxIdentifier"
              required
              inputMode="numeric"
              pattern="[0-9]{10}"
              maxLength={10}
            />
          </label>
          <label>
            Business license
            <input
              name="document"
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              required
            />
          </label>
          <button type="submit">Submit recruiter application</button>
        </form>
      </section>
      <section>
        <h2 className="text-2xl font-semibold">Your recruiter applications</h2>
        {items.length ? (
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <strong>{item.submittedCompanyName}</strong> — {item.state} —
                role {item.requestedRole}
                {[
                  "PENDING_CHECKS",
                  "PENDING_REVIEW",
                  "CHANGES_REQUESTED",
                ].includes(item.state) && (
                  <button
                    disabled={busyRequestId === item.id}
                    onClick={() => void cancel(item.id)}
                  >
                    Cancel
                  </button>
                )}
                {item.state === "CHANGES_REQUESTED" &&
                  item.resubmissionCount < 3 && (
                    <form onSubmit={(event) => void resubmit(item.id, event)}>
                      <label>
                        Replacement business license
                        <input
                          name="document"
                          type="file"
                          accept="application/pdf,image/png,image/jpeg"
                          required
                        />
                      </label>
                      <button
                        disabled={busyRequestId === item.id}
                        type="submit"
                      >
                        Resubmit evidence
                      </button>
                    </form>
                  )}
              </li>
            ))}
          </ul>
        ) : (
          <p>No verification requests.</p>
        )}
      </section>
    </main>
  );
}
