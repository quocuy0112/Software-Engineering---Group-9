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
  formatVerificationEmailTimestamp,
  membershipRoleLabel,
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
  const timestamp = formatVerificationEmailTimestamp(props.occurredAt);
  if (props.eventKind === "VERIFICATION_APPROVED")
    return `${props.companyDisplayName} is verified. Company membership role: ${membershipRoleLabel(props.approvedMembershipRole ?? "")}. Open Recruiter workspace: ${props.recruiterWorkspaceUrl}. Your Candidate identity remains unchanged.`;
  if (props.eventKind === "VERIFICATION_REJECTED")
    return `We reviewed your employer verification request submitted on ${timestamp}. Unfortunately, we could not approve it because the company details provided do not match our records. Feedback from our team: ${props.applicantComment ?? "The recorded reason is unavailable."} We want to help you get verified. Please double-check your company information and feel free to submit a new request in the app.`;
  return `Thank you for submitting your employer verification. Your request was safely received on ${timestamp} and is now undergoing standard review. Our team is working on it, and we will update you as soon as the check is complete. You do not need to take any action right now.`;
}

export function VerificationEmail(props: VerificationNotice) {
  const approved = props.eventKind === "VERIFICATION_APPROVED";
  const rejected = props.eventKind === "VERIFICATION_REJECTED";
  const timestamp = formatVerificationEmailTimestamp(props.occurredAt);
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
          ) : rejected ? (
            <>
              <Text>
                We reviewed your employer verification request submitted on{" "}
                {timestamp}.
              </Text>
              <Text>
                Unfortunately, we could not approve it because the company
                details provided do not match our records.
              </Text>
              <Text>
                Feedback from our team:{" "}
                {props.applicantComment ??
                  "The recorded reason is unavailable."}
              </Text>
              <Text>
                We want to help you get verified. Please double-check your
                company information and feel free to submit a new request in the
                app.
              </Text>
            </>
          ) : (
            <>
              <Text>
                Thank you for submitting your employer verification.
              </Text>
              <Text>
                Your request was safely received on {timestamp} and is now
                undergoing standard review.
              </Text>
              <Text>
                Our team is working on it, and we will update you as soon as the
                check is complete. You do not need to take any action right now.
              </Text>
            </>
          )}
        </Container>
      </Body>
    </Html>
  );
}