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
import type { AdminSecurityEventKind } from "./notification-events";
import {
  formatEmailTimestamp,
  reasonCategoryLabel,
} from "./email-format";

export type AccountSecurityNotice = {
  eventKind: Extract<
    AdminSecurityEventKind,
    | "ACCOUNT_SUSPENDED"
    | "ACCOUNT_REINSTATED"
    | "ACCOUNT_RESTORED"
    | "ALL_SESSIONS_REVOKED"
  >;
  resultingState: "ACTIVE" | "SUSPENDED";
  recipientName?: string;
  occurredAt: string;
  reasonCategory: string;
  supportUrl: string;
  appUrl: string;
};

const greeting = (name?: string) =>
  name ? `Hi ${name},` : "Hi,";

function bodyLines(props: AccountSecurityNotice): string[] {
  const timestamp = formatEmailTimestamp(props.occurredAt);
  const reason = reasonCategoryLabel(props.reasonCategory);
  if (props.eventKind === "ACCOUNT_SUSPENDED")
    return [
      `Please be advised that your SmartHire account was suspended on ${timestamp}.`,
      `Reason: ${reason}.`,
      "If you believe this was done in error or need assistance restoring your account, please reach out to us below.",
    ];
  if (
    props.eventKind === "ACCOUNT_REINSTATED" ||
    props.eventKind === "ACCOUNT_RESTORED"
  )
    return [
      `Great news! Your SmartHire account has been reactivated and is fully operational as of ${timestamp}.`,
      "The previous issue regarding your account has been resolved.",
    ];
  return [
    `All SmartHire sessions were revoked on ${timestamp}.`,
    `Reason: ${reason}.`,
    "Sign in again to continue.",
  ];
}

export function accountSecurityEmailText(props: AccountSecurityNotice) {
  const lines = bodyLines(props);
  return [
    greeting(props.recipientName),
    "",
    ...lines,
    "",
    props.eventKind === "ACCOUNT_SUSPENDED"
      ? "Contact Support:"
      : "Log In to SmartHire:",
    props.eventKind === "ACCOUNT_SUSPENDED"
      ? props.supportUrl
      : props.appUrl,
    "",
    "If you have any questions, feel free to reply to this email or contact us at support@smarthire.com.",
    "",
    "Best regards,",
    "The SmartHire Team",
  ].join("\n");
}

export function AccountSecurityEmail(props: AccountSecurityNotice) {
  const suspended = props.eventKind === "ACCOUNT_SUSPENDED";
  const reinstated =
    props.eventKind === "ACCOUNT_REINSTATED" ||
    props.eventKind === "ACCOUNT_RESTORED";
  const timestamp = formatEmailTimestamp(props.occurredAt);
  const reason = reasonCategoryLabel(props.reasonCategory);
  return (
    <Html>
      <Head />
      <Preview>
        {suspended
          ? "Your SmartHire account was suspended"
          : reinstated
            ? "Your SmartHire account is active"
            : "Your SmartHire sessions were revoked"}
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
            {suspended
              ? "Your SmartHire account was suspended"
              : reinstated
                ? "Great news! Your SmartHire account is active"
                : "Your SmartHire sessions were revoked"}
          </Heading>
          <Text>{greeting(props.recipientName)}</Text>
          {suspended ? (
            <>
              <Text>
                Please be advised that your SmartHire account was suspended on{" "}
                {timestamp}.
              </Text>
              <Text>
                Reason: {reason}.
              </Text>
              <Text>
                If you believe this was done in error or need assistance
                restoring your account, please reach out to us below.
              </Text>
            </>
          ) : reinstated ? (
            <>
              <Text>
                Great news! Your SmartHire account has been reactivated and is
                fully operational as of {timestamp}.
              </Text>
              <Text>
                The previous issue regarding your account has been resolved.
              </Text>
            </>
          ) : (
            <>
              <Text>
                All SmartHire sessions were revoked on {timestamp}.
              </Text>
              <Text>
                Reason: {reason}.
              </Text>
              <Text>Sign in again to continue.</Text>
            </>
          )}
          <Button
            href={suspended ? props.supportUrl : props.appUrl}
            style={{
              backgroundColor: "#155eef",
              color: "#ffffff",
              padding: "12px 18px",
              borderRadius: "8px",
            }}
          >
            {suspended ? "Contact Support" : "Log In to SmartHire"}
          </Button>
          <Text>
            If you have any questions, feel free to reply to this email or
            contact us at support@smarthire.com.
          </Text>
          <Text>Best regards,</Text>
          <Text style={{ fontWeight: "bold" }}>The SmartHire Team</Text>
        </Container>
      </Body>
    </Html>
  );
}