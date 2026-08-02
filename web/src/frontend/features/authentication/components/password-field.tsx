"use client";
import { useId, useState, type InputHTMLAttributes } from "react";
import { Input } from "@/frontend/components/ui/input";
import { PasswordVisibilityButton } from "@/frontend/components/ui/password-visibility-button";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  error?: string;
};
export function PasswordField({
  label,
  error,
  id: suppliedId,
  ...props
}: Props) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-control">
        <Input
          {...props}
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : props["aria-describedby"]}
        />
        <PasswordVisibilityButton
          controls={id}
          label={`${visible ? "Hide" : "Show"} password`}
          visible={visible}
          onClick={() => setVisible((value) => !value)}
        />
      </div>
      {error ? (
        <p id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
