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

export function ResetPasswordTemplate({ resetUrl }: { resetUrl: string }) {
  return (
    <Html>
      <Head />
      <Preview>Reset your SmartHire password</Preview>
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
          <Heading>Reset your password</Heading>
          <Text>
            This link expires in 30 minutes and can be used only once.
          </Text>
          <Button
            href={resetUrl}
            style={{
              backgroundColor: "#1d4ed8",
              color: "#fff",
              padding: "12px 18px",
              borderRadius: "6px",
            }}
          >
            Reset password
          </Button>
          <Text>
            If you did not request this change, you can ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function resetPasswordEmailText(resetUrl: string) {
  return `Reset your SmartHire password within 30 minutes. This link can be used only once:\n${resetUrl}\n\nIf you did not request this change, ignore this email.`;
}
