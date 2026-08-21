import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "react-email";

export type CompanyModerationNotice = {
  eventKind: "COMPANY_BANNED" | "COMPANY_UNBANNED";
  companyDisplayName: string;
  occurredAt: string;
};

export function companyModerationEmailText(props: CompanyModerationNotice) {
  return props.eventKind === "COMPANY_BANNED"
    ? `Access to ${props.companyDisplayName} was disabled. No company data was deleted.`
    : `Access to ${props.companyDisplayName} was restored.`;
}

export function CompanyModerationEmail(props: CompanyModerationNotice) {
  const banned = props.eventKind === "COMPANY_BANNED";
  return (
    <Html>
      <Head />
      <Preview>
        {banned ? "Company access disabled" : "Company access restored"}
      </Preview>
      <Body
        style={{ backgroundColor: "#f8fafc", fontFamily: "Arial, sans-serif" }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            margin: "32px auto",
            padding: "32px",
            maxWidth: "560px",
          }}
        >
          <Heading>
            {banned ? "Company access disabled" : "Company access restored"}
          </Heading>
          <Text>Company: {props.companyDisplayName}</Text>
          <Text>{companyModerationEmailText(props)}</Text>
        </Container>
      </Body>
    </Html>
  );
}
