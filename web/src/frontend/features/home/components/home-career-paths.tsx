import Link from "next/link";
import { careerPathSlugs } from "@/shared/contracts/jobs/career-paths";
import { homeCopy } from "../home-copy";
import type { HomeCareerPath, HomeLocale } from "../home-page-model";

function HomeCareerPathIcon({ slug }: { slug: (typeof careerPathSlugs)[number] }) {
  switch (slug) {
    case "software-engineering":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3.3v2.05m0 13.3v2.05M5.83 5.83l1.45 1.45m9.44 9.44 1.45 1.45M3.3 12h2.05m13.3 0h2.05M5.83 18.17l1.45-1.45m9.44-9.44 1.45-1.45" />
          <path d="M12 7.3a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4Z" />
          <path d="M12 9.55a2.45 2.45 0 1 0 0 4.9 2.45 2.45 0 0 0 0-4.9Z" />
        </svg>
      );
    case "ui-ux-design":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3.2a8.8 8.8 0 1 0 0 17.6h1.2a1.9 1.9 0 0 0 1.9-1.9c0-1.05-.84-1.9-1.9-1.9h-.68a2.15 2.15 0 0 1-2.15-2.15c0-1.19.96-2.15 2.15-2.15h3.27A3.2 3.2 0 0 0 19 9.6 6.4 6.4 0 0 0 12 3.2Z" />
          <path d="M7.4 10.1h.01M9.2 7.4h.01m4.35 0h.01m2.08 2.7h.01" />
        </svg>
      );
    case "data-ai":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4.2 20V9.8h4V20m3.8 0V4h4v16m3.8 0v-7.1h-4V20" />
          <path d="M3 20h18" />
        </svg>
      );
    case "digital-marketing":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m4 13.2 2.7.5 8-5.6v8.15l-8-5.55L4 11.2v2Zm2.7.5v4.15a1.85 1.85 0 0 0 1.85 1.85h1.2l-1.4-7.7" />
          <path d="M17.5 8.2c1 .82 1.5 1.85 1.5 3.08 0 1.24-.5 2.27-1.5 3.1" />
        </svg>
      );
    case "business-sales":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8.9 12.1 6.45 9.65a1.65 1.65 0 0 0-2.33 0L2.9 10.87a1.65 1.65 0 0 0 0 2.33l4.27 4.27a2.5 2.5 0 0 0 3.54 0l1.12-1.12" />
          <path d="m15.1 11.9 2.45 2.45a1.65 1.65 0 0 0 2.33 0l1.22-1.22a1.65 1.65 0 0 0 0-2.33l-4.27-4.27a2.5 2.5 0 0 0-3.54 0l-1.12 1.12" />
          <path d="m8.7 15.3 2.05 2.05a1.78 1.78 0 0 0 2.5 0l2.2-2.2a1.78 1.78 0 0 0 0-2.5l-2.15-2.15" />
        </svg>
      );
    case "product-management":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8.7" />
          <path d="m15.7 8.3-2.35 5.05-5.05 2.35 2.35-5.05 5.05-2.35Z" />
          <path d="M12 3.3v1.9M20.7 12h-1.9M12 20.7v-1.9M3.3 12h1.9" />
        </svg>
      );
  }
}

function countLabel(
  count: number | null,
  locale: HomeLocale,
): string {
  const copy = homeCopy[locale].careerPaths;
  if (count === null) return copy.countPending;
  if (count === 0) return copy.noJobs;
  return copy.openJobs.replace(
    "{count}",
    new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US").format(
      count,
    ),
  );
}

export function HomeCareerPaths({
  locale,
  paths,
}: {
  locale: HomeLocale;
  paths: readonly HomeCareerPath[];
}) {
  const copy = homeCopy[locale];
  const countBySlug = new Map(paths.map((path) => [path.slug, path.openJobCount]));
  return (
    <section
      className="home-section home-career-paths"
      id="career-paths"
      aria-labelledby="career-paths-title"
    >
      <div className="home-section-heading">
        <p>{copy.careerPaths.eyebrow}</p>
        <h2 id="career-paths-title">{copy.careerPaths.title}</h2>
      </div>
      <div className="home-path-grid">
        {copy.careerPaths.cards.map((path) => {
          const { slug } = path;
          const count = countBySlug.get(slug) ?? null;
          const jobs = countLabel(count, locale);
          return (
            <article
              className={`home-path-card home-path-card--${slug}`}
              key={slug}
            >
              <Link
                className="home-path-card-link"
                href={`/jobs?careerPath=${slug}`}
                aria-label={`${path.title}. ${jobs}`}
              >
                <span className="home-path-icon">
                  <HomeCareerPathIcon slug={slug} />
                </span>
                <h3>{path.title}</h3>
                <p>{path.body}</p>
                <span className="home-path-card-footer">
                  <span className="home-path-open-count">{jobs}</span>
                  <span className="home-path-arrow" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M5 12h13m-5-5 5 5-5 5" />
                    </svg>
                  </span>
                </span>
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
