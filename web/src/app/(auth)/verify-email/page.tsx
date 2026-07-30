import { Suspense } from "react";
import { VerifyEmailResult } from "@/frontend/features/authentication/components/verify-email-result";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<p role="status">Loading verification…</p>}>
      <VerifyEmailResult />
    </Suspense>
  );
}
