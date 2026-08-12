"use client";

import { CsrfProofProvider } from "@/frontend/features/authentication/client/csrf-proof-context";
import {
  HomeLocaleProvider,
  useHomeLocale,
} from "../client/home-locale-provider";
import { homeCopy } from "../home-copy";
import type { HomePageModel } from "../home-page-model";
import { HomeHeader } from "./home-header";
import { HomeHeroSearch } from "./home-hero-search";
import { HomeHeroCtas } from "./home-hero-ctas";
import { HomeOpportunityRadar } from "./home-opportunity-radar";
import { HomeWhatsNew } from "./home-whats-new";
import { HomeSmartMatch } from "./home-smart-match";
import { HomeCareerPaths } from "./home-career-paths";
import { HomeEmployerSpotlight } from "./home-employer-spotlight";
import { HomeTrendingJobs } from "./home-trending-jobs";
import { HomeGrowthHub } from "./home-growth-hub";
import { HomeCareerEvents } from "./home-career-events";
import { HomeFinalCta } from "./home-final-cta";
import { HomeFooter } from "./home-footer";

function HomeContent({ model }: { model: HomePageModel }) {
  const { locale } = useHomeLocale();
  const copy = homeCopy[locale];
  return (
    <main className="home-page">
      <HomeHeader viewer={model.viewer} />
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <p>{copy.hero.eyebrow}</p>
          <h1 id="home-title">{copy.hero.title}</h1>
          <p className="home-hero-description">{copy.hero.description}</p>
          <HomeHeroSearch />
          <HomeHeroCtas viewer={model.viewer} locale={locale} />
        </div>
        <HomeOpportunityRadar locale={locale} />
      </section>
      <HomeWhatsNew locale={locale} />
      <HomeSmartMatch model={model} locale={locale} />
      <HomeCareerPaths locale={locale} />
      <HomeEmployerSpotlight model={model} locale={locale} />
      <HomeTrendingJobs model={model} locale={locale} />
      <HomeGrowthHub locale={locale} />
      <HomeCareerEvents locale={locale} />
      <HomeFinalCta viewer={model.viewer} locale={locale} />
      <HomeFooter locale={locale} />
    </main>
  );
}

export function HomePageView({ model }: { model: HomePageModel }) {
  const csrfProof = model.viewer.kind === "guest" ? "" : model.viewer.csrfProof;
  return (
    <CsrfProofProvider value={csrfProof}>
      <HomeLocaleProvider initialLocale={model.initialLocale}>
        <HomeContent model={model} />
      </HomeLocaleProvider>
    </CsrfProofProvider>
  );
}
