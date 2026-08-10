import type { JobDetail } from "@/shared/contracts/jobs/discovery";
import { jobWhyHighlights } from "./job-detail-data";

const icons = ["✦", "↗", "♡"];

export function WhyJoinUsSection({ job }: { job: JobDetail }) {
  const highlights = jobWhyHighlights(job);

  return (
    <section className="job-why-join" aria-labelledby="why-join-heading">
      <div className="job-section-heading-row">
        <div>
          <p className="panel-kicker">The Smart Hire signal</p>
          <h2 id="why-join-heading">Why you&apos;ll love working here</h2>
        </div>
        <span className="job-section-heading-mark" aria-hidden="true">
          ✦
        </span>
      </div>
      <div className="job-why-join-grid">
        {highlights.map((highlight, index) => (
          <article className="job-why-join-card" key={highlight}>
            <span className="job-why-join-icon" aria-hidden="true">
              {icons[index] ?? "✦"}
            </span>
            <p>{highlight}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
