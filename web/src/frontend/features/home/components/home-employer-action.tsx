import Link from "next/link";
import { recruiterRoutes } from "@/shared/routing/recruiter-routes";
import type { HomeCopy } from "../home-copy";
import type { HomeViewer } from "../home-page-model";

export function HomeEmployerAction({
  viewer,
  copy,
  label = copy.hero.postJob,
  className,
}: {
  viewer: HomeViewer;
  copy: HomeCopy;
  label?: string;
  className?: string;
}) {
  const actionClassName = ["home-button", "home-button--secondary", className]
    .filter(Boolean)
    .join(" ");
  const disabledClassName = ["home-button", "home-button--disabled", className]
    .filter(Boolean)
    .join(" ");
  if (viewer.kind === "guest")
    return (
      <Link
        className={actionClassName}
        href="/login?returnTo=%2Fdashboard%2Femployer-verification"
      >
        {label}
      </Link>
    );
  const status = viewer.recruiterStatus;
  if (!status)
    return (
      <span className={disabledClassName} aria-disabled="true">
        {label} · {copy.hero.postJobUnavailable}
      </span>
    );
  if (status.state === "PENDING_REVIEW" || !status.href)
    return (
      <span className={disabledClassName} aria-disabled="true">
        {label} · {copy.hero.postJobPending}
      </span>
    );
  if (status.state === "CHANGES_REQUESTED")
    return (
      <Link className={actionClassName} href={status.href}>
        {copy.hero.postJobChangesRequested}
      </Link>
    );
  if (status.state === "APPROVED")
    return (
      <Link className={actionClassName} href={recruiterRoutes.jobPostings}>
        {label}
      </Link>
    );
  return (
    <Link className={actionClassName} href={status.href}>
      {label}
    </Link>
  );
}
