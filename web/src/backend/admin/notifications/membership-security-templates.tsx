import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "react-email";
import type { AdminSecurityEventKind } from "./notification-events";
import { formatEmailTimestamp } from "./email-format";

export type MembershipSecurityNotice = {
  eventKind: Extract<
    AdminSecurityEventKind,
    "MEMBERSHIP_SUSPENDED" | "MEMBERSHIP_RESTORED" | "MEMBERSHIP_REMOVED"
  >;
  companyDisplayName: string;
  resultingState: "ACTIVE" | "SUSPENDED" | "REMOVED";
  occurredAt: string;
};

export function membershipSecurityEmailText(props: MembershipSecurityNotice) {
  const timestamp = formatEmailTimestamp(props.occurredAt);
  const stateLabel =
    props.resultingState === "SUSPENDED"
      ? "suspended"
      : props.resultingState === "REMOVED"
        ? "removed"
        : "restored";
  return `Your company membership for ${props.companyDisplayName} is now ${stateLabel}. Effective at ${timestamp}.`;
}

export function MembershipSecurityEmail(props: MembershipSecurityNotice) {
  const timestamp = formatEmailTimestamp(props.occurredAt);
  const stateLabel =
    props.resultingState === "SUSPENDED"
      ? "suspended"
      : props.resultingState === "REMOVED"
        ? "removed"
        : "restored";
  return (
    <Html>
      <Head />
      <Preview>Company membership changed</Preview>
      <Body
        style={{ backgroundColor: "#f8fafc", fontFamily: "Arial, sans-serif" }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            margin: "32px auto",
            padding: "32px",
            maxWidth: "560px",
          }}
        >
          <Heading>Company membership changed</Heading>
          <Text>Company: {props.companyDisplayName}</Text>
          <Text>
            Your membership is now {stateLabel}, effective at {timestamp}.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}