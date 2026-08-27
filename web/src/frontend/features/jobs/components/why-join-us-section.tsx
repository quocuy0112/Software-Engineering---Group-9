import type { JobDetail } from "@/shared/contracts/jobs/discovery";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { jobWhyHighlights } from "./job-detail-data";
import { jobCopy } from "./job-copy";

const icons = ["✦", "↗", "♡"];

export function WhyJoinUsSection({ job }: { job: JobDetail }) {
  const locale = useWorkspaceLocale();
  const copy = jobCopy(locale);
  const highlights = jobWhyHighlights(job, locale);

  return (
    <section className="job-why-join" aria-labelledby="why-join-heading">
      <div className="job-section-heading-row">
        <div>
          <p className="panel-kicker">{copy.whySignal}</p>
          <h2 id="why-join-heading">{copy.whyWorkingHere}</h2>
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
