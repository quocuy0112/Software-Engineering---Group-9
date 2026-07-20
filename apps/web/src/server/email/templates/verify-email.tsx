import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";

export function VerifyEmailTemplate({ verificationUrl }: { verificationUrl: string }) {
  return <Html><Head /><Preview>Verify your SmartHire email address</Preview><Body style={{ backgroundColor: "#f8fafc", fontFamily: "Arial, sans-serif" }}><Container style={{ backgroundColor: "#fff", margin: "32px auto", padding: "32px", maxWidth: "560px" }}><Heading>Verify your email address</Heading><Text>Confirm your SmartHire account within 24 hours.</Text><Button href={verificationUrl} style={{ backgroundColor: "#1d4ed8", color: "#fff", padding: "12px 18px", borderRadius: "6px" }}>Verify email</Button><Text>If the button does not work, copy this link:</Text><Text>{verificationUrl}</Text></Container></Body></Html>;
}

export function verificationEmailText(verificationUrl: string) {
  return `Verify your SmartHire email address within 24 hours:\n${verificationUrl}`;
}
