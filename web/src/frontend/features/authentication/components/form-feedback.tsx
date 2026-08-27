"use client";

import { Alert } from "@/frontend/components/ui/alert";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { authCopy } from "./auth-copy";
import { AuthStatus } from "./auth-status";

export function FormFeedback({
  title,
  errors = [],
  status,
  tone = "error",
}: {
  title?: string;
  errors?: string[];
  status?: string;
  tone?: "message" | "error" | "success";
}) {
  const copy = authCopy(useWorkspaceLocale());
  return (
    <>
      {errors.length ? (
        <Alert tone="error" role="alert" tabIndex={-1} data-error-summary>
          <strong>{title ?? copy.common.reviewForm}</strong>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {status ? <AuthStatus status={status} tone={tone} /> : null}
    </>
  );
}
