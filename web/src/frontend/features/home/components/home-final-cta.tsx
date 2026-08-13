import Link from "next/link";
import { homeCopy } from "../home-copy";
import type { HomeLocale, HomeViewer } from "../home-page-model";
import { HomeEmployerAction } from "./home-employer-action";

export function HomeFinalCta({ viewer, locale }: { viewer: HomeViewer; locale: HomeLocale }) {
  const copy = homeCopy[locale];
  return (
    <section className="home-final-cta">
      <div className="home-final-cta-panel home-final-cta-panel--candidate"><p>{copy.finalCta.seekerEyebrow}</p><h2>{copy.finalCta.seekerTitle}</h2><Link className="home-button" href={viewer.kind === "guest" ? "/register" : "/profile"}>{copy.hero.createProfile}</Link></div>
      <div className="home-final-cta-panel home-final-cta-panel--employer"><p>{copy.finalCta.employerEyebrow}</p><h2>{copy.finalCta.employerTitle}</h2><HomeEmployerAction viewer={viewer} copy={copy} /></div>
    </section>
  );
}
