import Link from "next/link";
import { homeCopy } from "../home-copy";
import type { HomeLocale, HomeViewer } from "../home-page-model";
import { HomeEmployerAction } from "./home-employer-action";

export function HomeHeroCtas({
  locale,
  viewer,
}: {
  locale: HomeLocale;
  viewer: HomeViewer;
}) {
  const copy = homeCopy[locale];
  return (
    <div className="home-hero-ctas">
      <Link className="home-button home-hero-role-cta" href="/jobs">
        {copy.hero.findJobsNow}
      </Link>
      <HomeEmployerAction
        viewer={viewer}
        copy={copy}
        label={copy.hero.forEmployers}
        className="home-hero-role-cta"
      />
    </div>
  );
}
