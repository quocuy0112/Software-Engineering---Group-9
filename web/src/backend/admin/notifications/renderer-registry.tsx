import "server-only";
import { render } from "@react-email/render";
import { createElement } from "react";
import { z } from "zod";
import {
  AccountSecurityEmail,
  accountSecurityEmailText,
} from "./account-security-templates";
import {
  MembershipSecurityEmail,
  membershipSecurityEmailText,
} from "./membership-security-templates";
import {
  VerificationEmail,
  verificationEmailText,
} from "./verification-templates";
import {
  adminSecurityEventKinds,
  verificationEventKinds,
  type AdminSecurityEventKind,
  type VerificationEventKind,
} from "./notification-events";

const eventBase = z.object({
  eventKind: z.string(),
  occurredAt: z.string().datetime(),
});
const accountPayload = eventBase.extend({
  resultingState: z.enum(["ACTIVE", "SUSPENDED"]),
});
const membershipPayload = eventBase.extend({
  companyDisplayName: z.string().trim().min(1).max(200),
  resultingState: z.enum(["ACTIVE", "SUSPENDED", "REMOVED"]),
});
const verificationPayload = eventBase.extend({
  requestId: z.string().min(1).max(128),
  resultingState: z.string().min(1).max(64),
  nextAction: z.string().min(1).max(128),
  companyDisplayName: z.string().trim().min(1).max(200).optional(),
  approvedMembershipRole: z
    .enum(["OWNER", "HR_MANAGER", "RECRUITER", "HIRING_MANAGER"])
    .optional(),
});

export type RenderedFeature006Email = {
  subject: string;
  html: string;
  text: string;
};

function recruiterWorkspaceUrl(appUrl: string) {
  const configured = process.env.NEXT_PUBLIC_RECRUITER_ORIGIN;
  if (configured) return new URL("/", configured).toString();
  const url = new URL(appUrl);
  url.hostname =
    url.hostname === "localhost"
      ? "console.recruiter.localhost"
      : `console.recruiter.${url.hostname}`;
  url.pathname = "/";
  return url.toString();
}

export async function renderFeature006Email(input: {
  templateVersion: string;
  payloadRef: unknown;
  appUrl: string;
}): Promise<RenderedFeature006Email> {
  const raw = input.payloadRef as { eventKind?: string };
  if (input.templateVersion === "admin-security-v1") {
    if (
      !adminSecurityEventKinds.includes(raw.eventKind as AdminSecurityEventKind)
    )
      throw new Error("ADMIN_SECURITY_EVENT_KIND_UNSUPPORTED");
    if (raw.eventKind?.startsWith("MEMBERSHIP_")) {
      const payload = membershipPayload.parse(input.payloadRef);
      const props = {
        ...payload,
        eventKind: payload.eventKind as Extract<
          AdminSecurityEventKind,
          "MEMBERSHIP_SUSPENDED" | "MEMBERSHIP_RESTORED" | "MEMBERSHIP_REMOVED"
        >,
      };
      return {
        subject: `Company membership ${props.resultingState.toLowerCase()}`,
        html: await render(createElement(MembershipSecurityEmail, props)),
        text: membershipSecurityEmailText(props),
      };
    }
    const payload = accountPayload.parse(input.payloadRef);
    const props = {
      ...payload,
      eventKind: payload.eventKind as Extract<
        AdminSecurityEventKind,
        "ACCOUNT_SUSPENDED" | "ACCOUNT_REINSTATED" | "ALL_SESSIONS_REVOKED"
      >,
      supportUrl: new URL("/support/account-security", input.appUrl).toString(),
    };
    return {
      subject:
        props.eventKind === "ACCOUNT_SUSPENDED"
          ? "Your SmartHire account was suspended"
          : props.eventKind === "ACCOUNT_REINSTATED"
            ? "Your SmartHire account is active"
            : "Your SmartHire sessions were revoked",
      html: await render(createElement(AccountSecurityEmail, props)),
      text: accountSecurityEmailText(props),
    };
  }

  if (input.templateVersion === "verification-v1") {
    if (
      !verificationEventKinds.includes(raw.eventKind as VerificationEventKind)
    )
      throw new Error("VERIFICATION_EVENT_KIND_UNSUPPORTED");
    const payload = verificationPayload.parse(input.payloadRef);
    if (
      payload.eventKind === "VERIFICATION_APPROVED" &&
      (!payload.companyDisplayName || !payload.approvedMembershipRole)
    )
      throw new Error("VERIFICATION_APPROVAL_PAYLOAD_INVALID");
    const props = {
      ...payload,
      eventKind: payload.eventKind as VerificationEventKind,
      recruiterWorkspaceUrl:
        payload.eventKind === "VERIFICATION_APPROVED"
          ? recruiterWorkspaceUrl(input.appUrl)
          : undefined,
    };
    return {
      subject:
        payload.eventKind === "VERIFICATION_APPROVED"
          ? "Your company verification was approved"
          : "Employer verification update",
      html: await render(createElement(VerificationEmail, props)),
      text: verificationEmailText(props),
    };
  }
  throw new Error("FEATURE_006_TEMPLATE_UNSUPPORTED");
}
