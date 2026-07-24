"use client";

import { cloneElement, useState, type ReactElement } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  registrationSchema,
  type RegistrationInput,
} from "@/features/identity/schemas/registration";
import { PasswordField } from "./password-field";

export function RegisterForm() {
  const [complete, setComplete] = useState(false);
  const [serverStatus, setServerStatus] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<RegistrationInput>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      passwordConfirmation: "",
    },
  });
  const submit = handleSubmit(async (values) => {
    setServerStatus("");
    const response = await fetch("/api/identity/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const body = (await response.json()) as {
      message: string;
      fields?: Record<string, string[]>;
    };
    if (!response.ok) {
      for (const [field, messages] of Object.entries(body.fields ?? {}))
        setError(field as keyof RegistrationInput, { message: messages[0] });
      setServerStatus(body.message);
      toast.error("Registration needs attention.");
      return;
    }
    setComplete(true);
    toast.success("Check your email.");
  });
  if (complete)
    return (
      <div role="status" tabIndex={-1}>
        <h1>Check your email</h1>
        <p>
          If the address can be registered, a verification link has been sent.
        </p>
      </div>
    );
  return (
    <form
      className="auth-form"
      onSubmit={submit}
      noValidate
      aria-busy={isSubmitting}
    >
      <div className="auth-form-heading">
        <p className="form-kicker">START YOUR JOURNEY</p>
        <h1>Create your SmartHire account</h1>
        <p>All accounts begin with a Candidate identity.</p>
      </div>
      <Field label="Full name" error={errors.name?.message}>
        <input autoComplete="name" {...register("name")} />
      </Field>
      <Field label="Email address" error={errors.email?.message}>
        <input
          type="email"
          autoComplete="email"
          inputMode="email"
          {...register("email")}
        />
      </Field>
      <PasswordField
        label="Password"
        error={errors.password?.message}
        autoComplete="new-password"
        {...register("password")}
      />
      <PasswordField
        label="Confirm password"
        error={errors.passwordConfirmation?.message}
        autoComplete="new-password"
        {...register("passwordConfirmation")}
      />
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating account…" : "Create account"}
      </button>
      {serverStatus && <p role="alert">{serverStatus}</p>}
      <div role="status" aria-live="polite">
        {isSubmitting ? "Submitting securely." : ""}
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactElement<Record<string, unknown>>;
}) {
  const id = label.toLowerCase().replaceAll(" ", "-");
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, {
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": error ? `${id}-error` : undefined,
      })}
      {error && (
        <p id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
