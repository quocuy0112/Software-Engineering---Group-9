import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "react-email";

export type ProfessionalConnectionEmailProps = {
  eventKind:
    | "PROPOSAL_CREATED"
    | "PROPOSAL_UPDATED"
    | "PROPOSAL_NO_LONGER_ACTIVE"
    | "CONNECTION_ACCEPTED"
    | "CONNECTION_REVOKED";
  occurredAt: string;
  connectionsUrl: string;
};

const copy = {
  PROPOSAL_CREATED:
    "SmartHire sent you a professional connection proposal. Sign in to review it.",
  PROPOSAL_UPDATED:
    "A professional connection proposal was updated. Sign in to review its aggregate status.",
  PROPOSAL_NO_LONGER_ACTIVE:
    "A professional connection proposal is no longer active.",
  CONNECTION_ACCEPTED:
    "Both participants accepted. Your professional connection is now active.",
  CONNECTION_REVOKED:
    "A professional connection ended. Retained private chat history is read-only.",
} as const;

export function ProfessionalConnectionEmail(
  props: ProfessionalConnectionEmailProps,
) {
  return (
    <Html>
      <Head />
      <Preview>SmartHire professional connection update</Preview>
      <Body
        style={{ backgroundColor: "#f5f7fb", fontFamily: "Arial, sans-serif" }}
      >
        <Container
          style={{
            backgroundColor: "#fff",
            margin: "32px auto",
            padding: "32px",
            maxWidth: "560px",
          }}
        >
          <Heading>Professional connection update</Heading>
          <Text>{copy[props.eventKind]}</Text>
          <Text>Updated at: {props.occurredAt}</Text>
          <Button
            href={props.connectionsUrl}
            style={{
              backgroundColor: "#155eef",
              color: "#fff",
              padding: "12px 18px",
              borderRadius: "8px",
            }}
          >
            Open Connections
          </Button>
          <Text>
            This email intentionally excludes names, email addresses, reasons,
            decisions, support content, and private messages.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function professionalConnectionEmailText(
  props: ProfessionalConnectionEmailProps,
) {
  return [
    "SmartHire professional connection update",
    copy[props.eventKind],
    `Updated at: ${props.occurredAt}`,
    `Open Connections: ${props.connectionsUrl}`,
    "This email intentionally excludes names, email addresses, reasons, decisions, support content, and private messages.",
  ].join("\n");
}
