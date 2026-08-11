import { Body, Container, Heading, Html, Text } from "@react-email/components";
export function MembershipSecurityEmail(props: {
  companyReference: string;
  resultingState: string;
  occurredAt: string;
}) {
  return (
    <Html>
      <Body>
        <Container>
          <Heading>Company access changed</Heading>
          <Text>
            Your access for company reference {props.companyReference} is now{" "}
            {props.resultingState}.
          </Text>
          <Text>
            Effective at {props.occurredAt}. Visit account security if you need
            help.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
