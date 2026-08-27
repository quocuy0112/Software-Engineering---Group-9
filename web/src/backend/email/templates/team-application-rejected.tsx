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

export type TeamApplicationRejectedTemplateProps = {
  companyName: string;
  role: "HR_MANAGER" | "RECRUITER";
  reason?: string;
  applicationUrl: string;
};

function roleLabel(role: TeamApplicationRejectedTemplateProps["role"]) {
  return role === "HR_MANAGER" ? "HR Manager" : "Recruiter";
}

export function TeamApplicationRejectedTemplate({
  companyName,
  role,
  reason,
  applicationUrl,
}: TeamApplicationRejectedTemplateProps) {
  return (
    <Html>
      <Head />
      <Preview>Update on your team application to {companyName}</Preview>
      <Body
        style={{ backgroundColor: "#f8fafc", fontFamily: "Arial, sans-serif" }}
      >
        <Container
          style={{
            backgroundColor: "#fff",
            margin: "32px auto",
            maxWidth: "560px",
            padding: "32px",
          }}
        >
          <Heading>Team application update</Heading>
          <Text>
            Thank you for applying to join <strong>{companyName}</strong> as a{" "}
            <strong>{roleLabel(role)}</strong>. The Owner has decided not to
            move forward with this application.
          </Text>
          {reason ? (
            <Text>
              <strong>Message from the Owner:</strong> {reason}
            </Text>
          ) : null}
          <Button
            href={applicationUrl}
            style={{
              backgroundColor: "#2457d6",
              borderRadius: "8px",
              color: "#fff",
              display: "inline-block",
              padding: "12px 18px",
              textDecoration: "none",
            }}
          >
            View Team Applications
          </Button>
        </Container>
      </Body>
    </Html>
  );
}

export function teamApplicationRejectedEmailText({
  companyName,
  role,
  reason,
  applicationUrl,
}: TeamApplicationRejectedTemplateProps) {
  const suffix = reason ? ` Owner message: ${reason}` : "";
  return `Your application to join ${companyName} as ${roleLabel(role)} was not selected.${suffix} View Team Applications: ${applicationUrl}`;
}
