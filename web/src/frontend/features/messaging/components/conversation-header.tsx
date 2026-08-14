import Link from "next/link";
import type { WorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { messagingCopy } from "../messaging-copy";
import { MessagingAvatar } from "./messaging-avatar";

export function ConversationHeader({
  name,
  image,
  contextLabel,
  jobContextLabel,
  jobHref,
  presence,
  locale = "en",
}: {
  name: string;
  image?: string | null;
  contextLabel: string;
  jobContextLabel?: string | null;
  jobHref?: string | null;
  presence: "ONLINE" | "OFFLINE";
  locale?: WorkspaceLocale;
}) {
  const copy = messagingCopy(locale);
  const presenceLabel = presence === "ONLINE" ? copy.online : copy.offline;
  return (
    <div className="messaging-participant-header">
      <MessagingAvatar
        name={name}
        image={image}
        size="large"
        presence={presence}
      />
      <div>
        <h2>{name}</h2>
        <p className="messaging-context-label">{contextLabel}</p>
        {jobContextLabel ? (
          <div className="messaging-job-context-bar">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" />
              <rect x="3" y="7" width="18" height="13" rx="2" />
              <path d="M3 12h18M10 12v2h4v-2" />
            </svg>
            <span>{jobContextLabel}</span>
            {jobHref ? <Link href={jobHref}>{copy.viewJob}</Link> : null}
          </div>
        ) : null}
        <p
          className="messaging-presence-label"
          data-presence={presence.toLocaleLowerCase()}
          aria-label={
            locale === "vi"
              ? `${name} đang ${presenceLabel.toLocaleLowerCase()}`
              : `${name} is ${presenceLabel.toLocaleLowerCase()}`
          }
        >
          <span aria-hidden="true" />
          {presenceLabel}
        </p>
      </div>
    </div>
  );
}
