import Link from "next/link";

export default function CheckEmailPage() {
  return (
    <>
      <h1>Check your email</h1>
      <p>
        If the address is eligible, SmartHire has sent a verification link.
        Links expire after 24 hours.
      </p>
      <Link href="/login">Continue to sign in</Link>
    </>
  );
}
