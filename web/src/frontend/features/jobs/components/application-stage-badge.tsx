import {
  CalendarClock,
  CheckCircle2,
  CircleSlash,
  Eye,
  FileCheck2,
  ListChecks,
  PauseCircle,
  Send,
  XCircle,
} from "lucide-react";
import {
  applicationStageLabel,
  type ApplicationStage,
} from "@/shared/contracts/jobs/applications";

const stageIcons = {
  APPLIED: FileCheck2,
  VIEWED: Eye,
  SHORTLISTED: ListChecks,
  INTERVIEWING: CalendarClock,
  OFFERED: Send,
  HIRED: CheckCircle2,
  OFFER_DECLINED: CircleSlash,
  REJECTED: XCircle,
  WAITLISTED: PauseCircle,
} satisfies Record<ApplicationStage, typeof FileCheck2>;

export function ApplicationStageBadge({ stage }: { stage: ApplicationStage }) {
  const Icon = stageIcons[stage];
  return (
    <span
      className="application-stage-badge"
      data-stage={stage.toLowerCase().replaceAll("_", "-")}
    >
      <Icon className="application-stage-icon" aria-hidden="true" />
      {applicationStageLabel[stage]}
    </span>
  );
}
