import { AuthStatus } from "./auth-status";

export function FormFeedback({
  title = "Please review the form",
  errors = [],
  status,
}: {
  title?: string;
  errors?: string[];
  status?: string;
}) {
  return (
    <>
      {errors.length ? (
        <div role="alert" tabIndex={-1} data-error-summary>
          <strong>{title}</strong>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {status ? <AuthStatus status={status} tone="error" /> : null}
    </>
  );
}
