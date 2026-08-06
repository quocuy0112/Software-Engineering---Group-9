"use client";

import Link from "next/link";
import { useRef } from "react";
import type { JobCard } from "@/shared/contracts/jobs/discovery";
import { CompanyLogo } from "./job-detail-sidebar";

function salary(value: JobCard["salary"]) {
  if (!value) return "Salary not disclosed";
  const formatter = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: value.currency,
    maximumFractionDigits: 0,
  });
  return (
    formatter.format(value.minimum) + " - " + formatter.format(value.maximum)
  );
}

export function RelatedJobsCarousel({
  jobs,
  title = "Related jobs",
}: {
  jobs: JobCard[];
  title?: string;
}) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const rankedJobs = [...jobs]
    .sort((left, right) => (right.matchScore ?? -1) - (left.matchScore ?? -1))
    .slice(0, 6);

  function scroll(direction: number) {
    carouselRef.current?.scrollBy({
      left: direction * Math.max(carouselRef.current.clientWidth * 0.78, 280),
      behavior: "smooth",
    });
  }

  return (
    <section
      className="job-related-section"
      aria-labelledby="related-jobs-heading"
    >
      <div className="job-related-heading">
        <div>
          <p className="panel-kicker">KEEP EXPLORING</p>
          <h2 id="related-jobs-heading">{title}</h2>
        </div>
        <div className="job-carousel-controls">
          <button
            className="job-icon-button"
            type="button"
            aria-label={"Previous " + title.toLowerCase()}
            onClick={() => scroll(-1)}
          >
            ←
          </button>
          <button
            className="job-icon-button"
            type="button"
            aria-label={"Next " + title.toLowerCase()}
            onClick={() => scroll(1)}
          >
            →
          </button>
        </div>
      </div>
      <div
        ref={carouselRef}
        className="job-related-carousel"
        tabIndex={0}
        aria-label={title}
      >
        {rankedJobs.length ? (
          rankedJobs.map((job) => (
            <article className="job-related-card" key={job.id}>
              <div className="job-related-card-topline">
                <CompanyLogo company={job.company} />
                {job.matchScore !== undefined ? (
                  <span className="job-match-badge">
                    {job.matchScore}% match
                  </span>
                ) : null}
              </div>
              <p className="job-company-name">{job.company.displayName}</p>
              <h3>
                <Link href={"/jobs/" + job.slug}>{job.title}</Link>
              </h3>
              <p className="job-related-meta">
                {job.location} · {salary(job.salary)}
              </p>
              <Link className="job-related-link" href={"/jobs/" + job.slug}>
                Explore role <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))
        ) : (
          <p className="job-section-muted">
            No closely matched roles are available right now.
          </p>
        )}
      </div>
    </section>
  );
}
