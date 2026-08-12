import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export type SupportCaseEmailProps = {
  caseId: string;
  state: "WAITING_FOR_USER" | "RESOLVED";
  occurredAt: string;
  supportUrl: string;
};

export function SupportCaseEmail(props: SupportCaseEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your SmartHire support case was updated</Preview>
      <Body
        style={{ backgroundColor: "#f5f7fb", fontFamily: "Arial, sans-serif" }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            margin: "32px auto",
            padding: "32px",
            maxWidth: "560px",
          }}
        >
          <Heading>SmartHire Support update</Heading>
          <Text>Case reference: {props.caseId}</Text>
          <Text>
            {props.state === "WAITING_FOR_USER"
              ? "SmartHire Support replied. Sign in to read the response."
              : "SmartHire Support marked this case resolved. You may reopen it by replying within seven days."}
          </Text>
          <Text>Updated at: {props.occurredAt}</Text>
          <Section>
            <Button
              href={props.supportUrl}
              style={{
                backgroundColor: "#155eef",
                color: "#ffffff",
                padding: "12px 18px",
                borderRadius: "8px",
              }}
            >
              Open Support Center
            </Button>
          </Section>
          <Text>
            This email intentionally contains no support-message content.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function supportCaseEmailText(props: SupportCaseEmailProps) {
  return [
    "SmartHire Support update",
    `Case reference: ${props.caseId}`,
    props.state === "WAITING_FOR_USER"
      ? "SmartHire Support replied. Sign in to read the response."
      : "SmartHire Support marked this case resolved. You may reopen it by replying within seven days.",
    `Updated at: ${props.occurredAt}`,
    `Open Support Center: ${props.supportUrl}`,
    "This email intentionally contains no support-message content.",
  ].join("\n");
}
