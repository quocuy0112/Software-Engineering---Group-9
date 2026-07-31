import { AuthStatus } from "./auth-status";
import { Alert } from "@/components/ui/alert";

export function FormFeedback({
  title = "Please review the form",
  errors = [],
  status,
  tone = "error",
}: {
  title?: string;
  errors?: string[];
  status?: string;
  tone?: "message" | "error" | "success";
}) {
  return (
    <>
      {errors.length ? (
        <Alert tone="error" role="alert" tabIndex={-1} data-error-summary>
          <strong>{title}</strong>
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
