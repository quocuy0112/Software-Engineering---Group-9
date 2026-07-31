"use client";

import { useForm } from "react-hook-form";
import type { PendingEmailChange } from "@/shared/contracts/account/identity";

type EmailChangeValues = {
  newEmail: string;
  currentPassword: string;
};

export function EmailChangeForm({
  pending,
  requesting,
  onRequest,
}: {
  pending: PendingEmailChange | null;
  requesting: boolean;
  onRequest: (newEmail: string, currentPassword: string) => Promise<boolean>;
}) {
  const { register, handleSubmit } = useForm<EmailChangeValues>({
    defaultValues: { newEmail: "", currentPassword: "" },
  });

  return (
    <section
      className="account-identity-panel"
      aria-labelledby="email-change-title"
    >
      <div className="account-panel-heading">
        <div>
          <p className="panel-kicker">VERIFIED LOGIN ADDRESS</p>
          <h2 id="email-change-title">Change email</h2>
        </div>
      </div>
      {pending ? (
        <div className="email-change-pending">
          <strong>Verification pending for {pending.proposedEmail}</strong>
          <span>
            The current email remains active until confirmation. This request
            expires {new Date(pending.expiresAt).toLocaleString()}.
          </span>
        </div>
      ) : (
        <p className="account-panel-copy">
          The current address remains your login until the proposed address is
          verified.
        </p>
      )}
      <form
        onSubmit={handleSubmit(async ({ newEmail, currentPassword }) => {
          await onRequest(newEmail, currentPassword);
        })}
      >
        <label htmlFor="proposed-email">Proposed email</label>
        <input
          id="proposed-email"
          type="email"
          maxLength={320}
          autoComplete="email"
          {...register("newEmail")}
        />
        <label htmlFor="email-change-current-password">Current password</label>
        <input
          id="email-change-current-password"
          type="password"
          maxLength={128}
          autoComplete="current-password"
          {...register("currentPassword")}
        />
        <button type="submit" disabled={requesting}>
          {requesting
            ? "Requesting verification..."
            : "Request verification email"}
        </button>
      </form>
      <p className="account-panel-guidance">
        Delivery is asynchronous. If mail does not arrive, keep these values and
        retry the same request before choosing a different address.
      </p>
    </section>
  );
}
