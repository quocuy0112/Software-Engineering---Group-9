import "server-only";

import { createHmac } from "node:crypto";
import {
  ANALYTICS_VISITOR_DIGEST_VERSION,
  type AnalyticsViewQualification,
} from "@/shared/contracts/analytics";
import { analyticsConfiguration } from "./analytics-config";

type ViewInput = Readonly<{
  postingId: string;
  visitorIdentity: string;
  occurredAt: Date;
  userAgent?: string | null;
  isOwnerPreview: boolean;
}>;

function localDay(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return values.year + "-" + values.month + "-" + values.day;
}

function platformDay(value: Date, timeZone: string): Date {
  const day = localDay(value, timeZone);
  return new Date(day + "T00:00:00.000Z");
}

export function classifyJobPostingView(input: ViewInput): Readonly<{
  qualification: AnalyticsViewQualification;
  platformDay: Date;
  visitorDayDigest: string;
  digestVersion: number;
}> {
  const config = analyticsConfiguration();
  const day = localDay(input.occurredAt, config.platformTimeZone);
  let qualification: AnalyticsViewQualification = "QUALIFIED";
  if (input.isOwnerPreview) qualification = "OWNER_PREVIEW";
  else if (!input.visitorIdentity.trim()) qualification = "INVALID";
  else if (config.viewBotUserAgentPattern.test(input.userAgent ?? "")) {
    qualification = "AUTOMATED";
  }

  const visitorDayDigest = createHmac("sha256", config.visitorHmacKey)
    .update(
      "analytics-v1|" +
        input.postingId +
        "|" +
        day +
        "|" +
        input.visitorIdentity,
    )
    .digest("hex");

  return {
    qualification,
    platformDay: platformDay(input.occurredAt, config.platformTimeZone),
    visitorDayDigest,
    digestVersion: ANALYTICS_VISITOR_DIGEST_VERSION,
  };
}

export function requestVisitorIdentity(headers: Headers, userId?: string | null) {
  if (userId) return "user:" + userId;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || headers.get("x-real-ip")?.trim();
  return address ? "ip:" + address : "";
}
