import Link from "next/link";
import type { HomeCopy } from "../home-copy";
import type { HomeViewer } from "../home-page-model";

export function HomeEmployerAction({
  viewer,
  copy,
}: {
  viewer: HomeViewer;
  copy: HomeCopy;
}) {
  if (viewer.kind === "guest")
    return <Link className="home-button home-button--secondary" href="/login?returnTo=%2Fdashboard%2Femployer-verification">{copy.hero.postJob}</Link>;
  const status = viewer.recruiterStatus;
  if (!status)
    return <span className="home-button home-button--disabled" aria-disabled="true">{copy.hero.postJob} · {copy.hero.postJobUnavailable}</span>;
  if (status.state === "PENDING_REVIEW" || !status.href)
    return <span className="home-button home-button--disabled" aria-disabled="true">{copy.hero.postJob} · {copy.hero.postJobPending}</span>;
  return <Link className="home-button home-button--secondary" href={status.href}>{copy.hero.postJob}</Link>;
}
