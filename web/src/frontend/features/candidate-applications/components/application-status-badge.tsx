"use client";

import type { LucideIcon } from "lucide-react";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  ListChecks,
  Mail,
  Undo2,
  XCircle,
} from "lucide-react";
import type { ApplicationStage } from "@/shared/contracts/jobs/applications";

export type ApplicationListStatus = ApplicationStage | "WITHDRAWN";

const stageIcon: Record<ApplicationListStatus, LucideIcon> = {
  APPLIED: FileCheck2,
  VIEWED: Eye,
  SHORTLISTED: ListChecks,
  INTERVIEWING: CalendarClock,
  OFFERED: Mail,
  HIRED: CheckCircle2,
  OFFER_DECLINED: XCircle,
  REJECTED: XCircle,
  WAITLISTED: Clock,
  WITHDRAWN: Undo2,
};

export function ApplicationStatusBadge({
  status,
  label,
  className,
}: {
  status: ApplicationListStatus;
  label: string;
  className?: string;
}) {
  const Icon = stageIcon[status];
  return (
    <span
      className={["candidate-application-status-badge", className]
        .filter(Boolean)
        .join(" ")}
      data-stage={status.toLowerCase().replaceAll("_", "-")}
    >
      <Icon aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
