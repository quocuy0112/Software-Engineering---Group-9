import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  Code2,
  Compass,
  Handshake,
  Megaphone,
  Palette,
  type LucideIcon,
} from "lucide-react";
import { careerPathSlugs } from "@/shared/contracts/jobs/career-paths";
import { homeCopy } from "../home-copy";
import type { HomeCareerPath, HomeLocale } from "../home-page-model";

const careerPathIcons: Record<(typeof careerPathSlugs)[number], LucideIcon> = {
  "software-engineering": Code2,
  "ui-ux-design": Palette,
  "data-ai": BarChart3,
  "digital-marketing": Megaphone,
  "business-sales": Handshake,
  "product-management": Compass,
};

function HomeCareerPathIcon({
  slug,
}: {
  slug: (typeof careerPathSlugs)[number];
}) {
  const Icon = careerPathIcons[slug];
  return <Icon aria-hidden="true" />;
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
                    <ArrowUpRight />
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
