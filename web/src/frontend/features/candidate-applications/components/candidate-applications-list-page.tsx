"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  candidateApplicationListResponseSchema,
  type CandidateApplicationSummary,
  type PublicStage,
} from "@/shared/contracts/candidate-applications";

function date(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

const filters: Array<{ value: "ALL" | PublicStage; label: string }> = [
  { value: "ALL", label: "All applications" },
  { value: "APPLICATION_SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW", label: "Under review" },
  { value: "INTERVIEW", label: "Interview" },
  { value: "OUTCOME", label: "Outcome" },
];

function ApplicationListCard({ application }: { application: CandidateApplicationSummary }) {
  return (
    <article className="candidate-application-list-card">
      <div><p className="workspace-kicker">{application.companyName}</p><h2>{application.jobTitle}</h2><p>{application.location} · Submitted {date(application.submittedAt)}</p></div>
      <div className="candidate-application-list-card__status"><strong>{application.publicOutcome ?? application.publicStage.replaceAll("_", " ").toLowerCase()}</strong><span>Updated {date(application.lastUpdatedAt)}</span></div>
      <Link className="application-detail-link" href={`/jobs/applied/${encodeURIComponent(application.applicationId)}`}>View application status <span aria-hidden="true">→</span></Link>
    </article>
  );
}

export function CandidateApplicationsListPage({
  initialApplications,
  initialNextCursor,
}: {
  initialApplications: readonly CandidateApplicationSummary[];
  initialNextCursor: string | null;
}) {
  const [applications, setApplications] = useState(() => [...initialApplications]);
  const [filter, setFilter] = useState<"ALL" | PublicStage>("ALL");
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filtered = useMemo(() => filter === "ALL" ? applications : applications.filter((item) => item.publicStage === filter), [applications, filter]);

  async function loadMore() {
    if (!nextCursor || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/candidate/applications?cursor=${encodeURIComponent(nextCursor)}&limit=24`, { credentials: "same-origin", cache: "no-store" });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error("More applications could not be loaded.");
      const next = candidateApplicationListResponseSchema.parse(body);
      setApplications((current) => { const known = new Set(current.map((item) => item.applicationId)); return [...current, ...next.applications.filter((item) => !known.has(item.applicationId))]; });
      setNextCursor(next.nextCursor);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "More applications could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="candidate-application-flow candidate-application-list-page" aria-labelledby="candidate-applications-title">
      <header className="candidate-application-flow__header"><div><p className="workspace-kicker">Candidate workspace</p><h1 id="candidate-applications-title">Applications</h1><p>Track every application in one place.</p></div><span className="jobs-workspace-count">{applications.length}</span></header>
      <label className="candidate-application-filter"><span>Filter</span><select value={filter} onChange={(event) => setFilter(event.target.value as "ALL" | PublicStage)}>{filters.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      {error ? <p className="candidate-application-error" role="alert">{error}</p> : null}
      {filtered.length ? <div className="candidate-application-list">{filtered.map((application) => <ApplicationListCard key={application.applicationId} application={application} />)}</div> : <div className="workspace-inline-empty"><p>{applications.length ? "No applications match this filter." : "You have not applied to any jobs yet."}</p><Link className="sh-button" href="/jobs">Find jobs</Link></div>}
      {nextCursor ? <button type="button" className="job-secondary-button" disabled={loading} onClick={() => void loadMore()}>{loading ? "Loading…" : "Load more applications"}</button> : null}
    </section>
  );
}
