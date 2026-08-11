import { Body, Container, Heading, Html, Text } from "@react-email/components";
export type VerificationNotice = {
  requestId: string;
  resultingState: string;
  decisionTime?: string;
  nextAction: string;
};
export function VerificationEmail({
  requestId,
  resultingState,
  decisionTime,
  nextAction,
}: VerificationNotice) {
  return (
    <Html>
      <Body>
        <Container>
          <Heading>Employer verification update</Heading>
          <Text>
            Request {requestId} is now {resultingState}.
          </Text>
          {decisionTime && <Text>Recorded at {decisionTime}.</Text>}
          <Text>Next action: {nextAction}.</Text>
        </Container>
      </Body>
    </Html>
  );
}
