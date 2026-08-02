import Link from "next/link";

export default function JobUnavailable() {
  return (
    <main className="jobs-shell">
      <div className="jobs-container">
        <section className="job-panel">
          <h1>This job is not available</h1>
          <p>
            The link may be outdated, or the posting is not publicly available.
          </p>
          <Link href="/jobs">Browse active jobs</Link>
        </section>
      </div>
    </main>
  );
}
