import Link from "next/link";
import { homeCopy } from "../home-copy";
import type { HomeJob, HomeLocale, HomePageModel } from "../home-page-model";
import { HomeCompanyMark } from "./home-company-mark";
import { HomeMatchBreakdown, HomeMatchRing } from "./home-match-visuals";
import { HomeSaveJobAction } from "./home-save-job-action";
import { HomeSectionStateView } from "./home-section-state";

function MetadataSeparator() {
  return <span aria-hidden="true">{" \u00b7 "}</span>;
}

function formatSalary(job: HomeJob, locale: HomeLocale) {
  const salary = job.salary;
  const copy = homeCopy[locale].jobs;
  const isConfigured =
    salary !== null &&
    !salary.isNegotiable &&
    Number.isFinite(salary.minimum) &&
    Number.isFinite(salary.maximum) &&
    salary.minimum > 0 &&
    salary.maximum > 0;
  if (!isConfigured)
    return { kind: "negotiable" as const, text: copy.negotiableSalary };

  const formatter = new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", {
    maximumFractionDigits: 1,
  });
  const inMillions = (amount: number) =>
    amount >= 1_000_000 ? amount / 1_000_000 : amount;
  if (salary.currency === "VND") {
    const units = {
      HOUR: copy.hourlySalaryUnit,
      MONTH: copy.monthlySalaryUnit,
      YEAR: copy.yearlySalaryUnit,
    } as const;
    return {
      kind: "configured" as const,
      text: `\u20ab ${formatter.format(inMillions(salary.minimum))}–${formatter.format(inMillions(salary.maximum))} ${units[salary.period]}`,
    };
  }
  return {
    kind: "configured" as const,
    text: `${salary.currency} ${formatter.format(salary.minimum)}–${formatter.format(salary.maximum)}`,
  };
}

function postedLabel(job: HomeJob, locale: HomeLocale) {
  const postedAt = Date.parse(job.publishedAt);
  if (!Number.isFinite(postedAt)) return null;
  const days = Math.max(0, Math.floor((Date.now() - postedAt) / 86_400_000));
  return new Intl.RelativeTimeFormat(locale === "vi" ? "vi" : "en", {
    numeric: "auto",
  }).format(-days, "day");
}

function matchBreakdown(job: HomeJob, locale: HomeLocale) {
  const copy = homeCopy[locale];
  if (!job.matchBreakdown) return [];
  return [
    {
      key: "skills" as const,
      label: copy.smartMatch.skillsContribution,
      value: job.matchBreakdown.skills,
    },
    {
      key: "experience" as const,
      label: copy.smartMatch.experienceContribution,
      value: job.matchBreakdown.experience,
    },
    {
      key: "education" as const,
      label: copy.smartMatch.educationContribution,
      value: job.matchBreakdown.education,
    },
  ];
}

function MatchPrompt({
  model,
  job,
  locale,
}: {
  model: HomePageModel;
  job: HomeJob;
  locale: HomeLocale;
}) {
  const copy = homeCopy[locale];
  const guest = model.viewer.kind === "guest";
  const href = guest ? `/login?returnTo=/jobs/${job.slug}` : "/profile";
  const heading = guest
    ? copy.jobs.loginForMatch
    : copy.jobs.completeProfileForMatch;
  const description = guest
    ? copy.jobs.loginForMatchDescription
    : copy.jobs.completeProfileDescription;
  return (
    <div className="home-job-match-prompt">
      <p className="home-job-match-label">{copy.jobs.profileMatch}</p>
      <HomeMatchRing
        size="small"
        state="ghost"
        label={copy.jobs.lockedMatchLabel}
        scoreSuffix={copy.smartMatch.scoreSuffix}
      />
      <h3>{heading}</h3>
      <p className="home-job-match-description">{description}</p>
      <Link className="home-job-match-action" href={href}>
        {guest ? copy.account.login : copy.jobs.completeProfileAction}
      </Link>
      {!guest ? <small>{copy.jobs.completeProfileNote}</small> : null}
    </div>
  );
}

export function HomeTrendingJobs({
  model,
  locale,
}: {
  model: HomePageModel;
  locale: HomeLocale;
}) {
  const copy = homeCopy[locale];
  const filterLabels: Record<string, string> = copy.filters;
  const hasPersonalMatch = model.smartMatch.kind === "personal";
  const rankedJobs = [...model.jobs.items].slice(0, 6).sort((left, right) => {
    if (hasPersonalMatch)
      return (right.matchScore ?? -1) - (left.matchScore ?? -1);
    return Date.parse(right.publishedAt) - Date.parse(left.publishedAt);
  });
  const featuredJob = rankedJobs[0];
  const remainingJobs = rankedJobs.slice(1, 6);
  const featuredBreakdown = featuredJob
    ? matchBreakdown(featuredJob, locale)
    : [];
  const featuredSalary = featuredJob ? formatSalary(featuredJob, locale) : null;
  const featuredPosted = featuredJob ? postedLabel(featuredJob, locale) : null;

  return (
    <section
      className="home-section home-trending"
      id="jobs"
      aria-labelledby="trending-jobs"
    >
      <div className="home-section-heading">
        <p>{copy.jobs.eyebrow}</p>
        <h2 id="trending-jobs">{copy.jobs.title}</h2>
        <Link href="/jobs">{copy.common.viewAllJobs}</Link>
      </div>
      <HomeSectionStateView
        state={model.jobs}
        labels={{
          loading: copy.common.loading,
          empty: copy.jobs.empty,
          error: copy.jobs.error,
          reloadHome: copy.common.reloadHome,
        }}
      />
      {featuredJob ? (
        <>
          <article className="home-job-spotlight">
            <span className="home-job-spotlight-tag">
              <span aria-hidden="true">✦</span>
              {hasPersonalMatch ? copy.jobs.bestMatch : copy.jobs.featured}
            </span>
            <div className="home-job-spotlight-content">
              <div className="home-job-spotlight-main">
                <div className="home-job-company">
                  <HomeCompanyMark
                    name={featuredJob.companyName}
                    logoUrl={featuredJob.companyLogoUrl}
                  />
                  <div>
                    <p>{featuredJob.companyName}</p>
                    {featuredPosted ? <small>{featuredPosted}</small> : null}
                  </div>
                </div>
                <h3>
                  <Link href={`/jobs/${featuredJob.slug}`}>
                    {featuredJob.title}
                  </Link>
                </h3>
                <p className="home-job-spotlight-meta">
                  {featuredJob.location}
                  <MetadataSeparator />
                  {filterLabels[featuredJob.workArrangement]}
                  <MetadataSeparator />
                  {filterLabels[featuredJob.employmentType]}
                </p>
                {featuredSalary ? (
                  <p
                    className={`home-job-spotlight-salary home-job-salary--${featuredSalary.kind}`}
                  >
                    {featuredSalary.text}
                  </p>
                ) : null}
                <ul className="home-job-skills home-job-spotlight-skills">
                  {featuredJob.skills.map((skill) => (
                    <li key={skill}>{skill}</li>
                  ))}
                </ul>
                <div className="home-job-spotlight-actions">
                  <Link href={`/jobs/${featuredJob.slug}`}>
                    {copy.jobs.viewJobDetails}
                  </Link>
                  <HomeSaveJobAction
                    jobId={featuredJob.id}
                    slug={featuredJob.slug}
                    initialSaved={featuredJob.saved}
                    csrfProof={
                      model.viewer.kind === "guest"
                        ? undefined
                        : model.viewer.csrfProof
                    }
                    locale={locale}
                  />
                </div>
              </div>
              <div className="home-job-spotlight-match">
                {hasPersonalMatch && featuredJob.matchScore !== undefined ? (
                  <>
                    <p>{copy.jobs.profileMatch}</p>
                    <HomeMatchRing
                      score={featuredJob.matchScore}
                      size="small"
                      label={copy.smartMatch.scoreLabel.replace(
                        "{score}",
                        String(featuredJob.matchScore),
                      )}
                      scoreSuffix={copy.smartMatch.scoreSuffix}
                    />
                    {featuredBreakdown.length ? (
                      <HomeMatchBreakdown
                        items={featuredBreakdown}
                        size="small"
                        label={copy.jobs.matchSignals}
                      />
                    ) : null}
                  </>
                ) : (
                  <MatchPrompt
                    model={model}
                    job={featuredJob}
                    locale={locale}
                  />
                )}
              </div>
            </div>
          </article>
          {remainingJobs.length ? (
            <div className="home-job-list" aria-label={copy.jobs.title}>
              {remainingJobs.map((job, index) => {
                const salary = formatSalary(job, locale);
                return (
                  <article
                    className="home-job-list-row"
                    key={job.id}
                    style={{ animationDelay: `${50 + index * 60}ms` }}
                  >
                    <HomeCompanyMark
                      name={job.companyName}
                      logoUrl={job.companyLogoUrl}
                      compact
                    />
                    <div className="home-job-list-main">
                      <h3>
                        <Link href={`/jobs/${job.slug}`}>{job.title}</Link>
                      </h3>
                      <p>
                        <span>{job.companyName}</span>
                        <MetadataSeparator />
                        {job.location}
                        <MetadataSeparator />
                        {filterLabels[job.workArrangement]}
                        <MetadataSeparator />
                        {filterLabels[job.employmentType]}
                      </p>
                    </div>
                    <span
                      className={`home-job-list-salary home-job-salary--${salary.kind}`}
                    >
                      {salary.text}
                    </span>
                    {hasPersonalMatch && job.matchScore !== undefined ? (
                      <span className="home-job-list-match">
                        {job.matchScore}% {copy.jobs.matchEstimate}
                      </span>
                    ) : null}
                    <Link
                      className="home-job-list-arrow"
                      href={`/jobs/${job.slug}`}
                      aria-label={`${copy.jobs.viewJobDetails}: ${job.title}`}
                    >
                      <span aria-hidden="true">→</span>
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
