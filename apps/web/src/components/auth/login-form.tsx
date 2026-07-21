"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/features/identity/schemas/login";
import { PasswordField } from "./password-field";
import { FormFeedback } from "./form-feedback";

export function LoginForm({ returnTo = "/settings/sessions" }: { returnTo?: string }) {
  const [status, setStatus] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "", returnTo } });
  const submit = handleSubmit(async (values) => {
    setStatus("");
    const response = await fetch("/api/identity/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(values) });
    const body = await response.json() as { message: string; requiresTwoFactor?: boolean; fields?: Record<string, string[]> };
    if (!response.ok) {
      for (const [field, messages] of Object.entries(body.fields ?? {})) setError(field as keyof LoginInput, { message: messages[0] });
      setStatus(body.message); return;
    }
    if (body.requiresTwoFactor) { window.location.assign("/two-factor"); return; }
    window.location.assign(returnTo);
  });
  return <form onSubmit={submit} noValidate aria-busy={isSubmitting}><h1 id="page-title">Sign in to SmartHire</h1><div className="field"><label htmlFor="login-email">Email address</label><input id="login-email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} {...register("email")}/>{errors.email ? <p role="alert">{errors.email.message}</p> : null}</div><PasswordField label="Password" autoComplete="current-password" error={errors.password?.message} {...register("password")}/><button type="submit" disabled={isSubmitting}>{isSubmitting ? "Signing in…" : "Sign in"}</button><FormFeedback status={status}/></form>;
}
