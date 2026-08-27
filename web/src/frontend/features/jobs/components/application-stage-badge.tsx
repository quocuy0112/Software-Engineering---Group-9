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
  type ApplicationStage,
} from "@/shared/contracts/jobs/applications";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { applicationCopy } from "@/frontend/features/candidate-applications/i18n/application-copy";

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
  const copy = applicationCopy(useWorkspaceLocale());
  const Icon = stageIcons[stage];
  return (
    <span
      className="application-stage-badge"
      data-stage={stage.toLowerCase().replaceAll("_", "-")}
    >
      <Icon className="application-stage-icon" aria-hidden="true" />
      {copy.applicationsList.statuses[stage]}
    </span>
  );
}
