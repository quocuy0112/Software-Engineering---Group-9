import {
  Body,
  Container,
  Heading,
  Html,
  Link,
  Text,
} from "react-email";
import type { AdminSecurityEventKind } from "./notification-events";

export type AccountSecurityNotice = {
  eventKind: Extract<
    AdminSecurityEventKind,
    | "ACCOUNT_SUSPENDED"
    | "ACCOUNT_REINSTATED"
    | "ACCOUNT_RESTORED"
    | "ALL_SESSIONS_REVOKED"
  >;
  resultingState: "ACTIVE" | "SUSPENDED";
  occurredAt: string;
  reasonCategory: string;
  supportUrl: string;
};

export function accountSecurityEmailText(props: AccountSecurityNotice) {
  if (props.eventKind === "ACCOUNT_SUSPENDED")
    return `Your SmartHire account is SUSPENDED effective ${props.occurredAt}. Reason category: ${props.reasonCategory}. All sessions have been revoked. Contact support or submit an appeal: ${props.supportUrl}`;
  if (
    props.eventKind === "ACCOUNT_REINSTATED" ||
    props.eventKind === "ACCOUNT_RESTORED"
  )
    return `Your SmartHire account is ACTIVE effective ${props.occurredAt}. Reason category: ${props.reasonCategory}. Sign in again because old sessions are not restored. Company memberships suspended separately are not restored automatically. Support: ${props.supportUrl}`;
  return `All SmartHire sessions were revoked effective ${props.occurredAt}. Reason category: ${props.reasonCategory}. Sign in again to continue. If this was unexpected, contact support: ${props.supportUrl}`;
}

export function AccountSecurityEmail(props: AccountSecurityNotice) {
  const suspended = props.eventKind === "ACCOUNT_SUSPENDED";
  const reinstated =
    props.eventKind === "ACCOUNT_REINSTATED" ||
    props.eventKind === "ACCOUNT_RESTORED";
  return (
    <Html>
      <Body>
        <Container>
          <Heading>
            {suspended
              ? "Your SmartHire account was suspended"
              : reinstated
                ? "Your SmartHire account is active"
                : "Your SmartHire sessions were revoked"}
          </Heading>
          <Text>
            {suspended || reinstated
              ? `Account state: ${props.resultingState}. Effective at ${props.occurredAt}. Reason category: ${props.reasonCategory}.`
              : `All sessions were revoked at ${props.occurredAt}. Reason category: ${props.reasonCategory}.`}
          </Text>
          {suspended && <Text>All existing sessions have been revoked.</Text>}
          {reinstated && (
            <>
              <Text>Sign in again; old sessions are not restored.</Text>
              <Text>
                Company memberships suspended separately are not restored
                automatically.
              </Text>
            </>
          )}
          {!suspended && !reinstated && <Text>Sign in again to continue.</Text>}
          <Text>
            <Link href={props.supportUrl}>
              Contact support or submit an appeal
            </Link>{" "}
            if this change was unexpected.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
