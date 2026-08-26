"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { SendHorizontal, UserRound } from "lucide-react";

type Detail = {
  thread: {
    id: string;
    state: "OPEN" | "READ_ONLY";
    canSend: boolean;
    job: { title: string; companyName: string };
    applicationStage: string;
    assignee: { userId: string; name: string; role: string } | null;
  };
  messages: Array<{
    id: string;
    senderUserId: string;
    content: string;
    createdAt: string;
  }>;
};

export function CandidateRecruitmentThread({
  applicationId,
  csrfProof,
}: {
  applicationId: string;
  csrfProof: string;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [content, setContent] = useState("");
  const [state, setState] = useState<
    "loading" | "not-assigned" | "error" | "ready"
  >("loading");
  const load = useCallback(async () => {
    const response = await fetch(
      `/api/candidate/applications/${encodeURIComponent(applicationId)}/recruitment-thread`,
      { credentials: "same-origin" },
    );
    if (response.status === 404) {
      setState("not-assigned");
      return;
    }
    if (!response.ok) {
      setState("error");
      return;
    }
    setDetail((await response.json()) as Detail);
    setState("ready");
  }, [applicationId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      void load();
    }, 3_000);
    return () => window.clearInterval(timer);
  }, [load]);
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!detail || !content.trim()) return;
    const response = await fetch(
      `/api/recruitment-threads/${encodeURIComponent(detail.thread.id)}/messages`,
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfProof,
        },
        body: JSON.stringify({
          clientOperationId: crypto.randomUUID(),
          content,
        }),
      },
    );
    if (response.ok) {
      setContent("");
      await load();
    }
  }
  return (
    <main className="recruitment-messaging recruitment-messaging--candidate">
      <Link
        className="application-detail-back"
        href={`/jobs/applied/${encodeURIComponent(applicationId)}`}
      >
        Back to application
      </Link>
      <header className="recruitment-chat-header">
        <div>
          <p>{detail?.thread.job.companyName ?? "Application communication"}</p>
          <h1>{detail?.thread.job.title ?? "Recruitment messages"}</h1>
        </div>
        <div className="recruitment-candidate-chat-status">
          {detail ? (
            <strong className="recruitment-chat-stage">
              {detail.thread.applicationStage}
            </strong>
          ) : null}
          <span>
            {detail?.thread.assignee
              ? `Chatting with ${detail.thread.assignee.name} (${detail.thread.assignee.role})`
              : "Conversation for this application"}
          </span>
        </div>
      </header>
      {state === "loading" ? (
        <p className="recruitment-messaging__empty">
          Loading secure conversation...
        </p>
      ) : null}
      {state === "not-assigned" ? (
        <p className="recruitment-messaging__empty">
          Messaging will be available when the company assigns a recruiter to
          your application.
        </p>
      ) : null}
      {state === "error" ? (
        <p className="recruitment-messaging__error">
          This conversation is unavailable right now.
        </p>
      ) : null}
      {detail ? (
        <section className="recruitment-messaging__thread recruitment-chat-thread">
          <div className="recruitment-messaging__messages recruitment-chat-history">
            {detail.messages.length ? (
              <>
                <p className="recruitment-chat-history__start">
                  Conversation started
                </p>
                {detail.messages.map((message) => {
                  const outgoing =
                    message.senderUserId !== detail.thread.assignee?.userId;
                  return (
                    <div
                      key={message.id}
                      className="recruitment-chat-message"
                      data-direction={outgoing ? "outgoing" : "incoming"}
                      aria-label={`Message from ${
                        outgoing ? "you" : (detail.thread.assignee?.name ?? "recruiter")
                      }`}
                    >
                      <span
                        className="recruitment-chat-message__avatar"
                        aria-hidden="true"
                      >
                        <UserRound />
                      </span>
                      <article
                        data-time={new Date(message.createdAt).toLocaleString()}
                      >
                        <div>{message.content}</div>
                        <time dateTime={message.createdAt} aria-hidden="true">
                          {new Date(message.createdAt).toLocaleString()}
                        </time>
                      </article>
                    </div>
                  );
                })}
              </>
            ) : (
              <p className="recruitment-messaging__empty">No messages yet.</p>
            )}
          </div>
          <form className="recruitment-chat-composer" onSubmit={send}>
            <label>
              <span className="sr-only">Message</span>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key !== "Enter" ||
                    event.shiftKey ||
                    event.nativeEvent.isComposing
                  )
                    return;
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }}
                disabled={!detail.thread.canSend}
                maxLength={2000}
                placeholder={
                  detail.thread.canSend
                    ? "Write a message..."
                    : "This conversation is read-only"
                }
              />
              <span
                className="recruitment-chat-composer__count"
                aria-live="polite"
              >
                {content.length}/2,000
              </span>
            </label>
            <div className="recruitment-chat-composer__actions">
              <span>
                Press Enter to send · Shift + Enter for a new line
              </span>
              <button
                type="submit"
                disabled={!detail.thread.canSend || !content.trim()}
              >
                Send <SendHorizontal aria-hidden="true" />
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </main>
  );
}
