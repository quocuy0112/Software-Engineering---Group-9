"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Check,
  CircleDot,
  CircleX,
  LoaderCircle,
  Sparkles,
  X,
} from "lucide-react";
import type { RankedApplicationRow } from "@/shared/contracts/scoring";

export type RankingTone =
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "purple"
  | "slate";

const pipelineStageLabels: Record<string, string> = {
  APPLIED: "New",
  VIEWED: "Viewed",
  SHORTLISTED: "Shortlisted",
  WAITLISTED: "Needs details",
  INTERVIEWING: "Interviewing",
  OFFERED: "Offer",
  HIRED: "Hired",
  OFFER_DECLINED: "Offer declined",
  REJECTED: "Rejected",
};

export function statusLabel(value: string) {
  return (
    pipelineStageLabels[value] ??
    value
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/gu, (letter) => letter.toUpperCase())
  );
}

export function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined) return "\u2014";
  return value.toFixed(1);
}

export function formatTableScore(value: number | null | undefined) {
  if (value === null || value === undefined) return "\u2014";
  return String(Math.round(value));
}

export type ScoreBadgeMeta = {
  code: string;
  label: string;
  tone: RankingTone;
  icon: LucideIcon;
};

export function scoreBadgeForRow(row: RankedApplicationRow): ScoreBadgeMeta {
  if (row.scoring.kind === "UNAVAILABLE") {
    return {
      code: "RULE_BASED",
      label: "Rule-based only",
      tone: "amber",
      icon: Check,
    };
  }
  if (row.scoring.kind === "PENDING") {
    return {
      code: "PENDING",
      label: "Processing",
      tone: "purple",
      icon: LoaderCircle,
    };
  }
  if (row.scoring.kind === "PROCESSING") {
    return {
      code: "PROCESSING",
      label: "Processing",
      tone: "purple",
      icon: LoaderCircle,
    };
  }
  if (row.scoreSummary.band) {
    const band = row.scoreSummary.band.code;
    if (band === "HIGH_MATCH") {
      return { code: band, label: "Strong match", tone: "green", icon: Check };
    }
    if (band === "LOW_MATCH") {
      return { code: band, label: "Low match", tone: "red", icon: X };
    }
    return {
      code: band,
      label: "Review needed",
      tone: "amber",
      icon: AlertCircle,
    };
  }

  return {
    code: "NOT_CALCULATED",
    label: "Not calculated",
    tone: "slate",
    icon: CircleDot,
  };
}

export function ScoreBadge({
  meta,
  compact = false,
}: {
  meta: ScoreBadgeMeta;
  compact?: boolean;
}) {
  const Icon = meta.icon;
  return (
    <span
      className={[
        "ranking-score-badge",
        `ranking-score-badge--${meta.tone}`,
        compact && "ranking-score-badge--compact",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Icon
        aria-hidden="true"
        className={meta.icon === LoaderCircle ? "is-spinning" : undefined}
      />
      <span>{meta.label}</span>
    </span>
  );
}

export function ScoreBadgeFromLabel({
  code,
  label,
  compact = false,
}: {
  code: string;
  label: string;
  compact?: boolean;
}) {
  const normalized = code.toUpperCase();
  const meta: ScoreBadgeMeta = normalized.includes("HIGH")
    ? { code, label, tone: "green", icon: Check }
    : normalized.includes("LOW")
      ? { code, label, tone: "red", icon: X }
      : normalized.includes("RULE") || normalized.includes("UNAVAILABLE")
        ? { code, label, tone: "amber", icon: Check }
        : normalized.includes("MEDIUM") || label === "Review needed"
          ? { code, label, tone: "amber", icon: AlertCircle }
        : normalized.includes("PROCESS") || normalized.includes("PENDING")
          ? { code, label, tone: "purple", icon: LoaderCircle }
          : { code, label, tone: "slate", icon: CircleDot };
  return <ScoreBadge meta={meta} compact={compact} />;
}

export function StatCard({
  label,
  value,
  tone,
  icon: Icon,
  loading = false,
}: {
  label: string;
  value: number | null | undefined;
  tone: RankingTone;
  icon: LucideIcon;
  loading?: boolean;
}) {
  return (
    <article className={`ranking-stat-card ranking-stat-card--${tone}`}>
      <span className="ranking-stat-card__icon" aria-hidden="true">
        <Icon />
      </span>
      <span className="ranking-stat-card__content">
        {loading ? (
          <span
            className="ranking-skeleton ranking-skeleton--stat"
            aria-hidden="true"
          />
        ) : (
          <strong>{value?.toLocaleString("en-US") ?? "—"}</strong>
        )}
        <span>{label}</span>
      </span>
    </article>
  );
}

export function RankingSkeleton({ className = "" }: { className?: string }) {
  return (
    <span className={`ranking-skeleton ${className}`} aria-hidden="true" />
  );
}

export function AiIcon({ className = "" }: { className?: string }) {
  return <Sparkles aria-hidden="true" className={className} />;
}

export function EmptyCandidatesIllustration() {
  return (
    <span className="ranking-empty-illustration" aria-hidden="true">
      <span className="ranking-empty-illustration__circle">
        <CircleX />
      </span>
      <span className="ranking-empty-illustration__spark ranking-empty-illustration__spark--one" />
      <span className="ranking-empty-illustration__spark ranking-empty-illustration__spark--two" />
    </span>
  );
}
