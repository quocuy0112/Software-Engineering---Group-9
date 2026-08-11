import { Body, Container, Heading, Html, Text } from "@react-email/components";
import type { AdminSecurityEventKind } from "./notification-events";

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
  return `Your company membership for ${props.companyDisplayName} is now ${props.resultingState}. Effective at ${props.occurredAt}.`;
}

export function MembershipSecurityEmail(props: MembershipSecurityNotice) {
  return (
    <Html>
      <Body>
        <Container>
          <Heading>Company membership changed</Heading>
          <Text>Company: {props.companyDisplayName}</Text>
          <Text>Membership state: {props.resultingState}</Text>
          <Text>Effective at {props.occurredAt}.</Text>
        </Container>
      </Body>
    </Html>
  );
}
