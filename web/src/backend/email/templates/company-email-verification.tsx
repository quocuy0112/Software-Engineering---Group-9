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

export function CompanyEmailVerificationTemplate({
  verificationUrl,
}: {
  verificationUrl: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>Verify your company email for SmartHire</Preview>
      <Body style={{ backgroundColor: "#f4f7f2", fontFamily: "Arial, sans-serif" }}>
        <Container style={{ backgroundColor: "#fff", margin: "32px auto", maxWidth: "560px", padding: "32px" }}>
          <Heading>Verify your company email</Heading>
          <Text>
            This link confirms control of this mailbox for one employer
            verification request. It does not automatically approve recruiter
            access.
          </Text>
          <Button href={verificationUrl} style={{ backgroundColor: "#365c3b", borderRadius: "8px", color: "#fff", padding: "12px 18px" }}>
            Verify company email
          </Button>
          <Text>This link expires within 24 hours.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export function companyEmailVerificationText(verificationUrl: string) {
  return [
    "Verify your company email for one SmartHire employer verification request.",
    "This does not automatically approve recruiter access.",
    verificationUrl,
  ].join("\n\n");
}
