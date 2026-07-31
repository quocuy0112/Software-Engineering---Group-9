import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";

export function EmailChangeAlertTemplate() {
  return (
    <Html>
      <Head />
      <Preview>A SmartHire email change was requested</Preview>
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
          <Heading>An email change was requested</Heading>
          <Text>
            A request was made to change the email address on your SmartHire
            account. Your current email remains active until the new address is
            verified.
          </Text>
          <Text>
            If you did not request this, sign in to review your account
            security.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function emailChangeAlertText() {
  return [
    "A request was made to change the email address on your SmartHire account.",
    "Your current email remains active until the new address is verified.",
    "If you did not request this, sign in to review your account security.",
  ].join(" ");
}
