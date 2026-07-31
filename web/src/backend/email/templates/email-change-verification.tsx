import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";

export function EmailChangeVerificationTemplate({
  verificationUrl,
}: {
  verificationUrl: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>Verify your new SmartHire email address</Preview>
      <Body
        style={{ backgroundColor: "#f7f8f5", fontFamily: "Arial, sans-serif" }}
      >
        <Container
          style={{
            backgroundColor: "#fff",
            margin: "32px auto",
            padding: "32px",
            maxWidth: "560px",
          }}
        >
          <Heading>Verify your new email address</Heading>
          <Text>
            Confirm this email change within 30 minutes. Your current login
            email remains active until verification succeeds.
          </Text>
          <Button
            href={verificationUrl}
            style={{
              backgroundColor: "#365c3b",
              color: "#fff",
              padding: "12px 18px",
              borderRadius: "8px",
            }}
          >
            Review email change
          </Button>
          <Text>If the button does not work, copy this link:</Text>
          <Text style={{ wordBreak: "break-all" }}>{verificationUrl}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export function emailChangeVerificationText(verificationUrl: string) {
  return [
    "Verify your new SmartHire email address within 30 minutes.",
    "Your current login email remains active until verification succeeds.",
    verificationUrl,
  ].join("\n\n");
}
