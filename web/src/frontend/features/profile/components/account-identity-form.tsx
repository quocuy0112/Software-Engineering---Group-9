"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { AccountIdentity } from "@/shared/contracts/account/identity";

export function AccountIdentityForm({
  identity,
  saving,
  onSave,
}: {
  identity: AccountIdentity;
  saving: boolean;
  onSave: (name: string) => Promise<boolean>;
}) {
  const { register, handleSubmit, reset } = useForm<{ name: string }>({
    defaultValues: { name: identity.name },
  });

  useEffect(() => {
    reset({ name: identity.name });
  }, [identity.name, reset]);

  return (
    <section
      className="account-identity-panel"
      aria-labelledby="identity-title"
    >
      <div className="account-panel-heading">
        <div>
          <p className="panel-kicker">ACCOUNT IDENTITY</p>
          <h2 id="identity-title">Full name and account details</h2>
        </div>
      </div>
      <form
        onSubmit={handleSubmit(async ({ name }) => {
          await onSave(name);
        })}
      >
        <label htmlFor="account-full-name">Full name</label>
        <input
          id="account-full-name"
          maxLength={150}
          autoComplete="name"
          {...register("name")}
        />
        <button type="submit" disabled={saving}>
          {saving ? "Saving full name..." : "Save full name"}
        </button>
      </form>
      <dl className="account-identity-metadata">
        <div>
          <dt>Current email</dt>
          <dd>{identity.email}</dd>
        </div>
        <div>
          <dt>Email verification</dt>
          <dd>{identity.emailVerified ? "Verified" : "Not verified"}</dd>
        </div>
        <div>
          <dt>Account status</dt>
          <dd>{identity.accountState}</dd>
        </div>
        <div>
          <dt>Account created</dt>
          <dd>
            {new Intl.DateTimeFormat("en", {
              dateStyle: "medium",
              timeZone: "UTC",
            }).format(new Date(identity.createdAt))}
          </dd>
        </div>
      </dl>
    </section>
  );
}
