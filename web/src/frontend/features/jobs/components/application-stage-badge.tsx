import {
  applicationStageLabel,
  type ApplicationStage,
} from "@/shared/contracts/jobs/applications";

export function ApplicationStageBadge({ stage }: { stage: ApplicationStage }) {
  return (
    <span
      className="application-stage-badge"
      data-stage={stage.toLowerCase().replaceAll("_", "-")}
    >
      <span className="application-stage-dot" aria-hidden="true" />
      {applicationStageLabel[stage]}
    </span>
  );
}
