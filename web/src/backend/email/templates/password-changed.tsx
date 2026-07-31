import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";

export function PasswordChangedTemplate() {
  return (
    <Html>
      <Head />
      <Preview>Your SmartHire password was changed</Preview>
      <Body
        style={{ backgroundColor: "#f8fafc", fontFamily: "Arial, sans-serif" }}
      >
        <Container
          style={{
            backgroundColor: "#fff",
            margin: "32px auto",
            padding: "32px",
            maxWidth: "560px",
          }}
        >
          <Heading>Your password was changed</Heading>
          <Text>
            Your SmartHire password was changed. Other sessions were signed out
            while the device that completed the change stayed connected.
          </Text>
          <Text>
            If you did not make this change, contact SmartHire support
            immediately.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function passwordChangedEmailText() {
  return "Your SmartHire password was changed. Other sessions were signed out while the device that completed the change stayed connected. If you did not make this change, contact SmartHire support immediately.";
}
