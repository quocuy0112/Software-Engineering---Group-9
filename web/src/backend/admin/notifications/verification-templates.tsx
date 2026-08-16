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
import type {
  CompanyMembershipRole,
  VerificationEventKind,
} from "./notification-events";
import {
  formatEmailTimestamp,
  membershipRoleLabel,
  nextActionLabel,
  rejectionCategoryLabel,
  verificationStateLabel,
} from "./email-format";

export type VerificationNotice = {
  eventKind: VerificationEventKind;
  requestId: string;
  resultingState: string;
  occurredAt: string;
  nextAction: string;
  companyDisplayName?: string;
  approvedMembershipRole?: CompanyMembershipRole;
  rejectionCategory?: string;
  applicantComment?: string;
  recruiterWorkspaceUrl?: string;
};

export function verificationEmailText(props: VerificationNotice) {
  const timestamp = formatEmailTimestamp(props.occurredAt);
  if (props.eventKind === "VERIFICATION_APPROVED")
    return `${props.companyDisplayName} is verified. Company membership role: ${membershipRoleLabel(props.approvedMembershipRole ?? "")}. Open Recruiter workspace: ${props.recruiterWorkspaceUrl}. Your Candidate identity remains unchanged.`;
  if (props.eventKind === "VERIFICATION_REJECTED")
    return `Employer verification request ${props.requestId} was rejected. Reason category: ${rejectionCategoryLabel(props.rejectionCategory ?? "OTHER")}. Reason: ${props.applicantComment ?? "The recorded reason is unavailable."} Recorded at ${timestamp}. ${nextActionLabel(props.nextAction)}`;
  return `Employer verification request ${props.requestId} is now ${verificationStateLabel(props.resultingState)}. Recorded at ${timestamp}. ${nextActionLabel(props.nextAction)}`;
}

export function VerificationEmail(props: VerificationNotice) {
  const approved = props.eventKind === "VERIFICATION_APPROVED";
  const timestamp = formatEmailTimestamp(props.occurredAt);
  return (
    <Html>
      <Head />
      <Preview>
        {approved
          ? "Your company verification was approved"
          : "Employer verification update"}
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
          <Heading>Employer verification update</Heading>
          {approved ? (
            <>
              <Text>{props.companyDisplayName} is verified.</Text>
              <Text>
                Company membership role:{" "}
                {membershipRoleLabel(props.approvedMembershipRole ?? "")}.
              </Text>
              <Text>Your Candidate identity remains unchanged.</Text>
              <Button
                href={props.recruiterWorkspaceUrl}
                style={{
                  backgroundColor: "#155eef",
                  color: "#ffffff",
                  padding: "12px 18px",
                  borderRadius: "8px",
                }}
              >
                Open Recruiter workspace
              </Button>
            </>
          ) : (
            <>
              <Text>
                Request {props.requestId} is now{" "}
                {verificationStateLabel(props.resultingState)}.
              </Text>
              {props.eventKind === "VERIFICATION_REJECTED" && (
                <>
                  <Text>
                    Reason category:{" "}
                    {rejectionCategoryLabel(props.rejectionCategory ?? "OTHER")}
                    .
                  </Text>
                  <Text>
                    Applicant-visible reason:{" "}
                    {props.applicantComment ??
                      "The recorded reason is unavailable."}
                  </Text>
                </>
              )}
              <Text>Recorded at {timestamp}.</Text>
              <Text>{nextActionLabel(props.nextAction)}</Text>
            </>
          )}
        </Container>
      </Body>
    </Html>
  );
}