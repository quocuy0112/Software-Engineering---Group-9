import { CompanyAvatar } from "@/frontend/features/jobs/components/company-avatar";
import { homeCopy } from "../home-copy";
import type { HomeLocale, HomePageModel } from "../home-page-model";
import { HomeSectionStateView } from "./home-section-state";

export function HomeEmployerSpotlight({ model, locale }: { model: HomePageModel; locale: HomeLocale }) {
  const copy = homeCopy[locale];
  return (
    <section className="home-section home-spotlight" id="employer-spotlight" aria-labelledby="employer-spotlight-title">
      <div className="home-section-heading"><p>{copy.spotlight.eyebrow}</p><h2 id="employer-spotlight-title">{copy.spotlight.title}</h2></div>
      <HomeSectionStateView state={model.spotlights} labels={{ loading: copy.common.loading, empty: copy.spotlight.empty, error: copy.spotlight.error, reloadHome: copy.common.reloadHome }} />
      {model.spotlights.items.length ? (
        <div className="home-spotlight-grid">
          {model.spotlights.items.map((company) => (
            <article className="home-spotlight-card" key={company.slug}>
              <div className="home-company-identity">
                <CompanyAvatar name={company.name} imageUrl={company.logoUrl} className="home-company-mark" />
                <h3>{company.name}</h3>
              </div>
              {company.publicSummary ? <p><span className="sr-only">{copy.spotlight.summaryLabel}: </span>{company.publicSummary}</p> : null}
              <ul>
                {company.publicLocation ? <li>{company.publicLocation}</li> : null}
                {company.industry ? <li>{company.industry}</li> : null}
                {company.size ? <li>{company.size}</li> : null}
              </ul>
              {company.openPositionCount !== undefined ? <small>{company.openPositionCount} {copy.spotlight.openPositions}</small> : null}
              <small>{copy.common.displayOnly}</small>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
