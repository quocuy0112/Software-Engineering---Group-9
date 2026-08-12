import Link from "next/link";
import { homeCopy } from "../home-copy";
import type { HomeLocale, HomePageModel } from "../home-page-model";
import { HomeSectionStateView } from "./home-section-state";
import { HomeSaveJobAction } from "./home-save-job-action";
import { smartMatchExplanationId } from "./home-smart-match";

export function HomeTrendingJobs({ model, locale }: { model: HomePageModel; locale: HomeLocale }) {
  const copy = homeCopy[locale];
  const filterLabels: Record<string, string> = copy.filters;
  return (
    <section className="home-section home-trending" id="jobs" aria-labelledby="trending-jobs">
      <div className="home-section-heading"><p>{copy.jobs.eyebrow}</p><h2 id="trending-jobs">{copy.jobs.title}</h2><Link href="/jobs">{copy.common.viewAllJobs}</Link></div>
      <HomeSectionStateView state={model.jobs} labels={{ loading: copy.common.loading, empty: copy.jobs.empty, error: copy.jobs.error, reloadHome: copy.common.reloadHome }} />
      {model.jobs.items.length ? (
        <div className="home-job-grid">
          {model.jobs.items.slice(0, 6).map((job) => {
            const describedBy = model.smartMatch.kind === "personal" && model.smartMatch.jobSlug === job.slug ? smartMatchExplanationId(job.slug) : undefined;
            return (
              <article className="home-job-card" key={job.id}>
                <div><p>{job.companyName}</p><h3><Link href={`/jobs/${job.slug}`}>{job.title}</Link></h3><span>{job.location} · {filterLabels[job.workArrangement]} · {filterLabels[job.employmentType]}</span></div>
                {job.matchScore !== undefined && describedBy ? <strong className="home-match-pill" aria-describedby={describedBy}>{job.matchScore}% {copy.jobs.matchEstimate}</strong> : null}
                <ul>{job.skills.map((skill) => <li key={skill}>{skill}</li>)}</ul>
                <div className="home-card-actions"><Link href={`/jobs/${job.slug}`}>{copy.common.viewRole}</Link><HomeSaveJobAction jobId={job.id} slug={job.slug} initialSaved={job.saved} csrfProof={model.viewer.kind === "guest" ? undefined : model.viewer.csrfProof} locale={locale} /></div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
