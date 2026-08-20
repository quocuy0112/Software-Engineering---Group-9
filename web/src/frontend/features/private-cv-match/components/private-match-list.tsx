"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  FileText,
  LockKeyhole,
  MapPin,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TriangleAlert,
  Zap,
} from "lucide-react";
import type { PrivateMatchListItem } from "@/shared/contracts/private-cv-match";
import { PageHeader } from "@/frontend/components/layout/page-header";
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
      <div className="private-match-list-main">
        <div className="private-match-list-title">
          <Link href={`/cv-match-check/${encodeURIComponent(item.checkId)}`}>
            {item.job.title}
          </Link>
          <span className={`private-match-badge ${status.className}`}>
            <i aria-hidden="true" />
            {status.label}
          </span>
        </div>
        <div className="private-match-list-job-meta">
          <span>{item.job.company}</span>
          <span aria-hidden="true">·</span>
          <span>
            <MapPin aria-hidden="true" />
            {item.job.location}
          </span>
        </div>
        <div className="private-match-list-check-meta">
          <span className="private-match-file-chip">
            <FileText aria-hidden="true" />
            <span>{item.cv.fileName}</span>
            <small>v{item.cv.version}</small>
          </span>
          <span>
            <CalendarDays aria-hidden="true" />
            Created {dateFormatter.format(new Date(item.createdAt))}
          </span>
          <span className="private-match-expiry-meta">
            <Clock3 aria-hidden="true" />
            Expires in {daysUntil(item.expiresAt)} days
          </span>
        </div>
      </div>
      <div className="private-match-list-actions">
        <Link
          className="private-match-preview-link"
          href={`/cv-match-check/${encodeURIComponent(item.checkId)}`}
        >
          View preview <ArrowRight aria-hidden="true" />
        </Link>
        <PrivateMatchDeleteControl
          checkId={item.checkId}
          compact
          onDeleted={onDeleted}
        />
      </div>
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
      <PageHeader
        className="private-match-page-header"
        eyebrow="Candidate workspace"
        title="CV Match Check"
        subtitle="Review your private CV-to-job previews before you apply."
        rightSlot={
          <Link
            className="private-match-primary-button"
            href="/cv-match-check/new"
          >
            <Plus aria-hidden="true" /> New private check
          </Link>
        }
      />

      <section className="private-match-card private-match-list-intro">
        <span className="private-match-list-intro-icon" aria-hidden="true">
          <ShieldCheck />
        </span>
        <div>
          <div className="private-match-list-intro-title">
            <h2>Your private previews</h2>
            <span className="private-match-list-private-badge">
              <LockKeyhole aria-hidden="true" /> 100% Private
            </span>
          </div>
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
            <Sparkles aria-hidden="true" /> Start a new check
            <ArrowRight aria-hidden="true" />
          </Link>
          <div className="private-match-empty-benefits">
            <div>
              <span className="private-match-empty-benefit-icon is-amber">
                <Zap aria-hidden="true" />
              </span>
              <p>Instant preview</p>
              <small>Deep match breakdown in seconds</small>
            </div>
            <div>
              <span className="private-match-empty-benefit-icon is-blue">
                <Target aria-hidden="true" />
              </span>
              <p>High precision</p>
              <small>Skill-by-skill evaluation</small>
            </div>
            <div>
              <span className="private-match-empty-benefit-icon is-green">
                <ShieldCheck aria-hidden="true" />
              </span>
              <p>Completely private</p>
              <small>No data shared with employers</small>
            </div>
          </div>
        </section>
      ) : (
        <section aria-labelledby="saved-checks-heading">
          <div className="private-match-list-heading">
            <h2 id="saved-checks-heading">Saved CV match checks</h2>
            <span className="private-match-storage-meter">
              <span>Storage</span>
              <strong>{items.length}</strong>
              <i aria-hidden="true">/</i>
              <b>50</b>
              <em aria-hidden="true">
                <i style={{ width: `${(items.length / 50) * 100}%` }} />
              </em>
            </span>
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
      <span>%</span>
    </span>
  );
}
