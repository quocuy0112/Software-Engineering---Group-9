import Link from "next/link";
import { BriefcaseBusiness, UserRound } from "lucide-react";
import { homeCopy } from "../home-copy";
import type { HomeLocale, HomeViewer } from "../home-page-model";
import { HomeEmployerAction } from "./home-employer-action";

export function HomeFinalCta({
  viewer,
  locale,
}: {
  viewer: HomeViewer;
  locale: HomeLocale;
}) {
  const copy = homeCopy[locale];
  return (
    <section
      className="home-final-cta"
      aria-label={copy.finalCta.seekerEyebrow}
    >
      <div className="home-final-cta-panel home-final-cta-panel--candidate">
        <span className="home-final-cta-icon" aria-hidden="true">
          <UserRound />
        </span>
        <p>{copy.finalCta.seekerEyebrow}</p>
        <h2>{copy.finalCta.seekerTitle}</h2>
        <Link
          className="home-button"
          href={viewer.kind === "guest" ? "/register" : "/profile"}
        >
          {copy.hero.createProfile}
        </Link>
      </div>
      <div className="home-final-cta-panel home-final-cta-panel--employer">
        <span className="home-final-cta-icon" aria-hidden="true">
          <BriefcaseBusiness />
        </span>
        <p>{copy.finalCta.employerEyebrow}</p>
        <h2>{copy.finalCta.employerTitle}</h2>
        <HomeEmployerAction viewer={viewer} copy={copy} />
      </div>
    </section>
  );
}
