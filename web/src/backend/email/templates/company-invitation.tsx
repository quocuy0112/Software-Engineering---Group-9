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

export type CompanyInvitationTemplateProps = {
  companyName: string;
  role: string;
  invitationUrl: string;
};

export function CompanyInvitationTemplate({
  companyName,
  role,
  invitationUrl,
}: CompanyInvitationTemplateProps) {
  return (
    <Html>
      <Head />
      <Preview>You are invited to join {companyName} on SmartHire</Preview>
      <Body
        style={{ backgroundColor: "#f4f7f2", fontFamily: "Arial, sans-serif" }}
      >
        <Container
          style={{
            backgroundColor: "#fff",
            margin: "32px auto",
            maxWidth: "560px",
            padding: "32px",
          }}
        >
          <Heading>You are invited to join a hiring team</Heading>
          <Text>
            You have been invited to join <strong>{companyName}</strong> as a{" "}
            <strong>{role}</strong> on SmartHire.
          </Text>
          <Button
            href={invitationUrl}
            style={{
              backgroundColor: "#2457d6",
              borderRadius: "8px",
              color: "#fff",
              padding: "12px 18px",
            }}
          >
            Check invitation
          </Button>
          <Text>
            This secure link can be used once and expires in seven days.
          </Text>
          <Text>
            If you were not expecting this invitation, you can safely ignore
            this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function companyInvitationEmailText({
  companyName,
  role,
  invitationUrl,
}: CompanyInvitationTemplateProps) {
  return `You have been invited to join ${companyName} as a ${role} on SmartHire. Accept this one-time invitation within seven days: ${invitationUrl}`;
}
