import { Suspense } from "react";
import {
  VerifyEmailLoading,
  VerifyEmailResult,
} from "@/frontend/features/authentication/components/verify-email-result";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailLoading />}>
      <VerifyEmailResult />
    </Suspense>
  );
}
