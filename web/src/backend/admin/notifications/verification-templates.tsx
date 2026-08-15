import {
  Body,
  Container,
  Heading,
  Html,
  Link,
  Text,
} from "react-email";
import type {
  CompanyMembershipRole,
  VerificationEventKind,
} from "./notification-events";

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
  if (props.eventKind === "VERIFICATION_APPROVED")
    return `${props.companyDisplayName} is verified. Company membership role: ${props.approvedMembershipRole}. Open Recruiter workspace: ${props.recruiterWorkspaceUrl}. Your Candidate identity remains unchanged.`;
  if (props.eventKind === "VERIFICATION_REJECTED")
    return `Employer verification request ${props.requestId} was rejected. Reason category: ${props.rejectionCategory ?? "UNAVAILABLE"}. Reason: ${props.applicantComment ?? "The recorded reason is unavailable."} Recorded at ${props.occurredAt}. Next action: ${props.nextAction}.`;
  return `Employer verification request ${props.requestId} is now ${props.resultingState}. Recorded at ${props.occurredAt}. Next action: ${props.nextAction}.`;
}

export function VerificationEmail(props: VerificationNotice) {
  const approved = props.eventKind === "VERIFICATION_APPROVED";
  return (
    <Html>
      <Body>
        <Container>
          <Heading>Employer verification update</Heading>
          {approved ? (
            <>
              <Text>{props.companyDisplayName} is verified.</Text>
              <Text>
                Company membership role: {props.approvedMembershipRole}.
              </Text>
              <Text>
                <Link href={props.recruiterWorkspaceUrl}>
                  Open Recruiter workspace
                </Link>
              </Text>
              <Text>Your Candidate identity remains unchanged.</Text>
            </>
          ) : (
            <>
              <Text>
                Request {props.requestId} is now {props.resultingState}.
              </Text>
              {props.eventKind === "VERIFICATION_REJECTED" && (
                <>
                  <Text>
                    Reason category: {props.rejectionCategory ?? "UNAVAILABLE"}.
                  </Text>
                  <Text>
                    Applicant-visible reason: {props.applicantComment ??
                      "The recorded reason is unavailable."}
                  </Text>
                </>
              )}
              <Text>Recorded at {props.occurredAt}.</Text>
              <Text>Next action: {props.nextAction}.</Text>
            </>
          )}
        </Container>
      </Body>
    </Html>
  );
}
