import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "react-email";

export type CompanyInvitationResponseTemplateProps = {
  companyName: string;
  recipientEmail: string;
  outcome: "ACCEPTED" | "DECLINED";
  role: string;
};

export function CompanyInvitationResponseTemplate({
  companyName,
  recipientEmail,
  outcome,
  role,
}: CompanyInvitationResponseTemplateProps) {
  const accepted = outcome === "ACCEPTED";
  return (
    <Html>
      <Head />
      <Preview>
        {recipientEmail} {accepted ? "accepted" : "declined"} your invitation
      </Preview>
      <Body style={{ backgroundColor: "#f4f7f2", fontFamily: "Arial, sans-serif" }}>
        <Container style={{ backgroundColor: "#fff", margin: "32px auto", maxWidth: "560px", padding: "32px" }}>
          <Heading>Team invitation update</Heading>
          <Text>
            <strong>{recipientEmail}</strong> {accepted ? "accepted" : "declined"}{" "}
            your invitation to join <strong>{companyName}</strong> as a{" "}
            <strong>{role}</strong>.
          </Text>
          <Text>Open Team settings in SmartHire to view the activity timeline.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export function companyInvitationResponseEmailText({
  companyName,
  recipientEmail,
  outcome,
  role,
}: CompanyInvitationResponseTemplateProps) {
  return `${recipientEmail} ${outcome === "ACCEPTED" ? "accepted" : "declined"} your invitation to join ${companyName} as a ${role}. Open Team settings in SmartHire to view the activity timeline.`;
}
