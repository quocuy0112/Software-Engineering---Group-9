"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BriefcaseBusiness,
  FileText,
  Plus,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import type { PrivateMatchListItem } from "@/shared/contracts/private-cv-match";
import {
  privateMatchErrorMessage,
  usePrivateCvMatchList,
} from "../client/use-private-cv-match";
import { PrivateMatchDeleteControl } from "./private-match-delete-control";

const dateFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

function daysUntil(value: string) {
  return Math.max(
    0,
    Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000),
  );
}

function statusCopy(state: PrivateMatchListItem["state"]) {
  switch (state) {
    case "READY":
      return { label: "Ready", className: "private-match-badge--green" };
    case "LIMITED":
      return { label: "Limited", className: "private-match-badge--yellow" };
    case "FAILED":
      return { label: "Failed", className: "private-match-badge--red" };
    case "ANALYZING":
      return { label: "Analyzing", className: "private-match-badge--blue" };
    default:
      return { label: "Queued", className: "private-match-badge--blue" };
  }
}

function scoreCopy(item: PrivateMatchListItem) {
  if (item.hybridScore !== null) return `${item.hybridScore}/100`;
  if (item.state === "LIMITED" && item.deterministicScore !== null) {
    return `Automatic ${item.deterministicScore}/100`;
  }
  return "—";
}

function ListSkeleton() {
  return (
    <div className="private-match-list" aria-busy="true" aria-live="polite">
      {[1, 2, 3].map((item) => (
        <div
          className="private-match-list-row private-match-list-row--skeleton"
          key={item}
        >
          <span />
          <div>
            <span />
            <span />
          </div>
          <span />
        </div>
      ))}
      <span className="private-match-visually-hidden">
        Loading saved CV match checks
      </span>
    </div>
  );
}

function ListItem({
  item,
  onDeleted,
}: {
  item: PrivateMatchListItem;
  onDeleted: () => void;
}) {
  const status = statusCopy(item.state);
  return (
    <article className="private-match-list-row">
      <span className="private-match-list-icon" aria-hidden="true">
        <BriefcaseBusiness />
      </span>
      <Link
        className="private-match-list-main"
        href={`/cv-match-check/${encodeURIComponent(item.checkId)}`}
      >
        <strong>{item.job.title}</strong>
        <span>
          {item.job.company} · {item.job.location}
        </span>
        <small>
          <FileText aria-hidden="true" /> {item.cv.fileName} · v
          {item.cv.version}
        </small>
      </Link>
      <div className="private-match-list-score">
        <span className={`private-match-badge ${status.className}`}>
          {status.label}
        </span>
        <strong>{scoreCopy(item)}</strong>
        <small>
          Created {dateFormatter.format(new Date(item.createdAt))} · Expires in{" "}
          {daysUntil(item.expiresAt)} days
        </small>
      </div>
      <PrivateMatchDeleteControl
        checkId={item.checkId}
        compact
        onDeleted={onDeleted}
      />
    </article>
  );
}

export function PrivateMatchList() {
  const query = usePrivateCvMatchList();
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set());
  const items =
    query.data?.items.filter((item) => !removedIds.has(item.checkId)) ?? [];
  return (
    <main className="private-match-page">
      <div className="private-match-breadcrumb">CV Match Check</div>
      <div className="private-match-title-row private-match-list-title-row">
        <div>
          <h1>CV Match Check</h1>
          <p>Review your private CV-to-job previews before you apply.</p>
        </div>
        <Link
          className="private-match-primary-button"
          href="/cv-match-check/new"
        >
          <Plus aria-hidden="true" /> New private check
        </Link>
      </div>

      <section className="private-match-card private-match-list-intro">
        <ShieldCheck aria-hidden="true" />
        <div>
          <h2>Your private previews</h2>
          <p>
            Only you can see these reports. They never change a recruiter&apos;s
            ranking or your application.
          </p>
        </div>
      </section>

      {query.isPending ? (
        <ListSkeleton />
      ) : query.isError ? (
        <section className="private-match-limit-card" role="alert">
          <TriangleAlert aria-hidden="true" />
          <div>
            <h2>Saved previews could not be loaded</h2>
            <p>{privateMatchErrorMessage(query.error)}</p>
            <button
              className="private-match-secondary-button"
              type="button"
              onClick={() => void query.refetch()}
            >
              <RefreshCw aria-hidden="true" /> Try again
            </button>
          </div>
        </section>
      ) : items.length === 0 ? (
        <section className="private-match-card private-match-empty private-match-list-empty">
          <GaugeIcon />
          <h2>Check your first CV match</h2>
          <p>
            Get a private, explainable preview for one job before you apply.
          </p>
          <Link
            className="private-match-primary-button"
            href="/cv-match-check/new"
          >
            <Plus aria-hidden="true" /> Start a new check
          </Link>
        </section>
      ) : (
        <section aria-labelledby="saved-checks-heading">
          <div className="private-match-list-heading">
            <h2 id="saved-checks-heading">Saved CV match checks</h2>
            <span>{items.length} of 50 retained previews</span>
          </div>
          <div className="private-match-list">
            {items.map((item) => (
              <ListItem
                item={item}
                key={item.checkId}
                onDeleted={() =>
                  setRemovedIds((current) => new Set(current).add(item.checkId))
                }
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function GaugeIcon() {
  return (
    <span className="private-match-list-empty-icon" aria-hidden="true">
      %
    </span>
  );
}
