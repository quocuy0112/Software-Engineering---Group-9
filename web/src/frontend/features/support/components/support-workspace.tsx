"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  SupportCaseDetail,
  SupportCaseSummary,
  SupportCategory,
} from "@/shared/contracts/support";
import { useSupportInvalidation } from "../client/use-support-invalidation";

const categories: Array<{ value: SupportCategory; label: string }> = [
  { value: "ACCOUNT_ACCESS", label: "Account access" },
  { value: "PROFILE", label: "Profile" },
  { value: "JOBS_APPLICATIONS", label: "Jobs and applications" },
  { value: "RECRUITER", label: "Recruiter services" },
  { value: "MESSAGING", label: "Messaging" },
  { value: "PRIVACY_SAFETY", label: "Privacy and safety" },
  { value: "OTHER", label: "Other" },
];

async function supportApi(
  path: string,
  csrfProof: string,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  if (init.method && init.method !== "GET")
    headers.set("x-csrf-proof", csrfProof);
  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(body.error?.message ?? "Support request failed.");
  return body;
}

export function SupportWorkspace({
  csrfProof,
  initialCases,
}: {
  csrfProof: string;
  initialCases: SupportCaseSummary[];
}) {
  const [cases, setCases] = useState(initialCases);
  const [selectedId, setSelectedId] = useState(initialCases[0]?.id ?? null);
  const [detail, setDetail] = useState<SupportCaseDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<SupportCategory>("ACCOUNT_ACCESS");
  const [subject, setSubject] = useState("");
  const [initialMessage, setInitialMessage] = useState("");
  const [reply, setReply] = useState("");

  const refreshCases = useCallback(async () => {
    const body = await supportApi("/api/support/cases", csrfProof);
    setCases(body.data);
  }, [csrfProof]);
  const refreshDetail = useCallback(
    async (caseId: string) => {
      const body = await supportApi(
        `/api/support/cases/${encodeURIComponent(caseId)}`,
        csrfProof,
      );
      setDetail(body.data);
    },
    [csrfProof],
  );

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    void supportApi(
      `/api/support/cases/${encodeURIComponent(selectedId)}`,
      csrfProof,
    )
      .then((body) => {
        if (active) setDetail(body.data);
      })
      .catch((reason) => {
        if (active) setError(String(reason.message ?? reason));
      });
    return () => {
      active = false;
    };
  }, [csrfProof, selectedId]);

  const connection = useSupportInvalidation(
    useCallback(
      (event) => {
        void refreshCases();
        if (event.caseId === selectedId) void refreshDetail(event.caseId);
      },
      [refreshCases, refreshDetail, selectedId],
    ),
  );

  async function createCase(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = await supportApi("/api/support/cases", csrfProof, {
        method: "POST",
        body: JSON.stringify({
          category,
          subject,
          message: initialMessage,
          clientOperationId: crypto.randomUUID(),
        }),
      });
      setSubject("");
      setInitialMessage("");
      setDetail(body.data);
      setSelectedId(body.data.id);
      await refreshCases();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to create case.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendReply(event: React.FormEvent) {
    event.preventDefault();
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      const body = await supportApi(
        `/api/support/cases/${encodeURIComponent(detail.id)}/messages`,
        csrfProof,
        {
          method: "POST",
          body: JSON.stringify({
            content: reply,
            clientOperationId: crypto.randomUUID(),
            expectedVersion: detail.version,
          }),
        },
      );
      setReply("");
      setDetail(body.data);
      await refreshCases();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to send message.",
      );
      await refreshDetail(detail.id).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="support-workspace">
      <header className="support-hero">
        <div>
          <p className="support-kicker">SMART HIRE SUPPORT</p>
          <h1>Support Center</h1>
          <p>
            Talk privately with the platform support team. Support agents cannot
            read your ordinary conversations.
          </p>
        </div>
        <span
          className="support-connection"
          data-state={connection.toLowerCase()}
          role="status"
        >
          {connection === "CONNECTED"
            ? "Realtime connected"
            : connection === "OFFLINE"
              ? "Offline"
              : "Connecting"}
        </span>
      </header>

      {error ? (
        <div className="support-alert" role="alert">
          {error}
        </div>
      ) : null}

      <section className="support-layout">
        <aside className="support-sidebar" aria-label="Support cases">
          <form className="support-new-case" onSubmit={createCase}>
            <h2>Start a support case</h2>
            <label>
              Category
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as SupportCategory)
                }
              >
                {categories.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Subject
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                minLength={5}
                maxLength={120}
                required
              />
            </label>
            <label>
              How can we help?
              <textarea
                value={initialMessage}
                onChange={(event) => setInitialMessage(event.target.value)}
                maxLength={4000}
                required
              />
            </label>
            <button
              type="submit"
              disabled={
                busy || subject.trim().length < 5 || !initialMessage.trim()
              }
            >
              {busy ? "Submitting…" : "Create case"}
            </button>
          </form>

          <div className="support-case-list">
            <h2>Your cases</h2>
            {cases.length === 0 ? (
              <p>No support cases yet.</p>
            ) : (
              cases.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={selectedId === item.id ? "selected" : undefined}
                  onClick={() => setSelectedId(item.id)}
                >
                  <strong>{item.subject}</strong>
                  <span>{item.category.replaceAll("_", " ")}</span>
                  <small>{item.state.replaceAll("_", " ")}</small>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="support-thread" aria-live="polite">
          {!detail ? (
            <div className="support-empty">
              <h2>Select a case</h2>
              <p>Choose an existing case or start a new one.</p>
            </div>
          ) : (
            <>
              <header>
                <div>
                  <p>{detail.correspondent}</p>
                  <h2>{detail.subject}</h2>
                </div>
                <span className="support-status">
                  {detail.state.replaceAll("_", " ")}
                </span>
              </header>
              <div className="support-messages">
                {!detail.contentAvailable ? (
                  <p>Message content was deleted under the retention policy.</p>
                ) : (
                  detail.messages.map((message) => (
                    <article key={message.id} data-author={message.author}>
                      <strong>
                        {message.author === "YOU" ? "You" : "SmartHire Support"}
                      </strong>
                      <p>{message.content}</p>
                      <time dateTime={message.createdAt}>
                        {new Date(message.createdAt).toLocaleString()}
                      </time>
                    </article>
                  ))
                )}
              </div>
              {detail.state !== "CLOSED" && detail.contentAvailable ? (
                <form className="support-reply" onSubmit={sendReply}>
                  <label htmlFor="support-reply">
                    Reply to SmartHire Support
                  </label>
                  <textarea
                    id="support-reply"
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    maxLength={4000}
                    required
                  />
                  <button type="submit" disabled={busy || !reply.trim()}>
                    {busy
                      ? "Sending…"
                      : detail.state === "RESOLVED"
                        ? "Reply and reopen"
                        : "Send reply"}
                  </button>
                </form>
              ) : (
                <p className="support-closed">
                  This case is closed. Create a new case if you need more help.
                </p>
              )}
            </>
          )}
        </section>
      </section>
    </main>
  );
}
