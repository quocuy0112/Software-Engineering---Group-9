import Link from "next/link";
import { HomeEmployerAction } from "./home-employer-action";
import { homeCopy } from "../home-copy";
import type { HomeLocale, HomeViewer } from "../home-page-model";

export function HomeHeroCtas({ viewer, locale }: { viewer: HomeViewer; locale: HomeLocale }) {
  const copy = homeCopy[locale];
  return (
    <div className="home-hero-ctas">
      <Link className="home-button home-button--secondary" href={viewer.kind === "guest" ? "/register" : "/profile"}>{copy.hero.createProfile}</Link>
      <HomeEmployerAction viewer={viewer} copy={copy} />
    </div>
  );
}
