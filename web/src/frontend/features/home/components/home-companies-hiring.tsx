import Link from "next/link";
import { homeCopy } from "../home-copy";
import type { HomeLocale, HomePageModel } from "../home-page-model";
import { HomeCompanyMark } from "./home-company-mark";
import { HomeSectionStateView } from "./home-section-state";

function numberLabel(value: number, locale: HomeLocale) {
  return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US").format(
    value,
  );
}

function positionLabel(value: number, locale: HomeLocale) {
  const copy = homeCopy[locale].companyHiring;
  if (value === 1) return copy.openPosition;
  return copy.openPositions.replace("{count}", numberLabel(value, locale));
}

export function HomeCompaniesHiring({
  model,
  locale,
}: {
  model: HomePageModel;
  locale: HomeLocale;
}) {
  const home = homeCopy[locale];
  const copy = home.companyHiring;
  const companies = model.spotlights.items.slice(0, 5);
  const total = model.companyCount;
  const remaining = Math.max((total ?? companies.length) - companies.length, 0);

  return (
    <section
      className="home-section home-companies-hiring"
      id="companies-hiring"
      aria-labelledby="companies-hiring-title"
    >
      <div className="home-section-heading">
        <p>{copy.eyebrow}</p>
        <h2 id="companies-hiring-title">{copy.title}</h2>
        <p className="home-section-description">
          {total === null
            ? copy.summaryUnavailable
            : (
                <>
                  <strong>{numberLabel(total, locale)}</strong>
                  {copy.summary.replace("{count}", "")}
                </>
              )}
        </p>
      </div>
      <HomeSectionStateView
        state={model.spotlights}
        labels={{
          loading: home.common.loading,
          empty: copy.empty,
          error: copy.error,
          reloadHome: home.common.reloadHome,
        }}
      />
      {companies.length ? (
        <div className="home-companies-hiring-grid">
          {companies.map((company) => (
            <article className="home-company-hiring-card" key={company.slug}>
              <HomeCompanyMark name={company.name} logoUrl={company.logoUrl} />
              <div>
                <h3>{company.name}</h3>
                <span>
                  {positionLabel(company.openPositionCount ?? 0, locale)}
                </span>
              </div>
            </article>
          ))}
          {remaining > 0 ? (
            <Link className="home-company-hiring-card home-company-hiring-card--more" href="/jobs">
              <span className="home-company-hiring-more-count" aria-hidden="true">
                +{numberLabel(remaining, locale)}
              </span>
              <span>
                <strong>{copy.moreCompanies}</strong>
                <small>{copy.viewAll}</small>
              </span>
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
