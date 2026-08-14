import Link from "next/link";
import { homeCopy } from "../home-copy";
import type { HomeLocale } from "../home-page-model";

export function HomeHeroCtas({ locale }: { locale: HomeLocale }) {
  const copy = homeCopy[locale];
  return (
    <div className="home-hero-ctas">
      <Link className="home-button home-hero-role-cta" href="/jobs">
        {copy.hero.findJobsNow}
      </Link>
      <Link
        className="home-button home-button--secondary home-hero-role-cta"
        href="/business"
      >
        {copy.hero.forEmployers}
      </Link>
    </div>
  );
}
