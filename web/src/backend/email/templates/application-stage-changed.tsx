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

export type ApplicationStageChangedTemplateProps = {
  stageLabel: string;
  jobTitle: string;
  companyName: string;
  applicationUrl: string;
};

export function ApplicationStageChangedTemplate({
  stageLabel,
  jobTitle,
  companyName,
  applicationUrl,
}: ApplicationStageChangedTemplateProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Your application for {jobTitle} is now {stageLabel}
      </Preview>
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
          <Heading>Your application has an update</Heading>
          <Text>
            Your application for <strong>{jobTitle}</strong> at {companyName}
            is now <strong>{stageLabel}</strong>.
          </Text>
          <Text>Open SmartHire to view the current stage and timeline.</Text>
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
            View application
          </Button>
        </Container>
      </Body>
    </Html>
  );
}

export function applicationStageChangedEmailText({
  stageLabel,
  jobTitle,
  companyName,
  applicationUrl,
}: ApplicationStageChangedTemplateProps) {
  return `Your application for ${jobTitle} at ${companyName} is now ${stageLabel}. View your application: ${applicationUrl}`;
}
