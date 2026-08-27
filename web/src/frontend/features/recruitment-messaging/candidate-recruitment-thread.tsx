"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { SendHorizontal, UserRound } from "lucide-react";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { recruiterWorkspaceCopy } from "@/frontend/features/recruiter-workspace/recruiter-workspace-copy";

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

function stageLabel(
  stage: string,
  labels: ReturnType<typeof recruiterWorkspaceCopy>["messages"]["stages"],
) {
  return labels[stage as keyof typeof labels] ?? stage;
}

function recruiterRoleLabel(
  role: string,
  copy: ReturnType<typeof recruiterWorkspaceCopy>,
) {
  if (role === "HR_MANAGER") return copy.role.hrManager;
  if (role === "HIRING_MANAGER") return copy.role.hiringManager;
  if (role === "OWNER") return copy.role.owner;
  return copy.role.recruiter;
}

export function CandidateRecruitmentThread({
  applicationId,
  csrfProof,
}: {
  applicationId: string;
  csrfProof: string;
}) {
  const locale = useWorkspaceLocale();
  const copy = recruiterWorkspaceCopy(locale);
  const messagesCopy = copy.messages;
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
        {messagesCopy.backToApplication}
      </Link>
      <header className="recruitment-chat-header">
        <div>
          <p>{detail?.thread.job.companyName ?? messagesCopy.applicationCommunication}</p>
          <h1>{detail?.thread.job.title ?? messagesCopy.recruitmentMessages}</h1>
        </div>
        <div className="recruitment-candidate-chat-status">
          {detail ? (
            <strong className="recruitment-chat-stage">
              {stageLabel(detail.thread.applicationStage, messagesCopy.stages)}
            </strong>
          ) : null}
          <span>
            {detail?.thread.assignee
              ? messagesCopy.chattingWith(
                  detail.thread.assignee.name,
                  recruiterRoleLabel(detail.thread.assignee.role, copy),
                )
              : messagesCopy.applicationConversation}
          </span>
        </div>
      </header>
      {state === "loading" ? (
        <p className="recruitment-messaging__empty">
          {messagesCopy.loadingConversation}
        </p>
      ) : null}
      {state === "not-assigned" ? (
        <p className="recruitment-messaging__empty">
          {messagesCopy.notAssigned}
        </p>
      ) : null}
      {state === "error" ? (
        <p className="recruitment-messaging__error">
          {messagesCopy.unavailable}
        </p>
      ) : null}
      {detail ? (
        <section className="recruitment-messaging__thread recruitment-chat-thread">
          <div className="recruitment-messaging__messages recruitment-chat-history">
            {detail.messages.length ? (
              <>
                <p className="recruitment-chat-history__start">
                  {messagesCopy.conversationStarted}
                </p>
                {detail.messages.map((message) => {
                  const outgoing =
                    message.senderUserId !== detail.thread.assignee?.userId;
                  return (
                    <div
                      key={message.id}
                      className="recruitment-chat-message"
                      data-direction={outgoing ? "outgoing" : "incoming"}
                      aria-label={messagesCopy.messageFrom(
                        outgoing
                          ? locale === "vi"
                            ? "bạn"
                            : "you"
                          : (detail.thread.assignee?.name ?? copy.role.recruiter),
                      )}
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
              <p className="recruitment-messaging__empty">
                {messagesCopy.noMessagesShort}
              </p>
            )}
          </div>
          <form className="recruitment-chat-composer" onSubmit={send}>
            <label>
              <span className="sr-only">{messagesCopy.message}</span>
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
                    ? messagesCopy.writeMessage
                    : messagesCopy.readOnlyConversation
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
                {messagesCopy.sendHint}
              </span>
              <button
                type="submit"
                disabled={!detail.thread.canSend || !content.trim()}
              >
                {messagesCopy.send} <SendHorizontal aria-hidden="true" />
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </main>
  );
}
