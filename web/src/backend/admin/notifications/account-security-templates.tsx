import { Body, Container, Heading, Html, Text } from "@react-email/components";
export function AccountSecurityEmail(props: {
  resultingState: string;
  occurredAt: string;
}) {
  return (
    <Html>
      <Body>
        <Container>
          <Heading>Account security changed</Heading>
          <Text>
            Your account security state is now {props.resultingState}.
          </Text>
          <Text>
            Effective at {props.occurredAt}. Review account security or contact
            support if unexpected.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
