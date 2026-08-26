"use client";
import { useId, useState, type InputHTMLAttributes } from "react";
import { Info } from "lucide-react";
import { Input } from "@/frontend/components/ui/input";
import { PasswordVisibilityButton } from "@/frontend/components/ui/password-visibility-button";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  error?: string;
  hint?: string;
};
export function PasswordField({
  label,
  error,
  hint,
  id: suppliedId,
  ...props
}: Props) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [
    props["aria-describedby"],
    hint ? hintId : undefined,
    error ? errorId : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="field">
      <div className="password-field-label">
        <label htmlFor={id}>{label}</label>
        {hint ? (
          <span className="password-field-hint">
            <button
              type="button"
              className="password-field-hint-trigger"
              aria-label={`${label} requirements`}
              aria-describedby={hintId}
            >
              <Info aria-hidden="true" size={16} strokeWidth={2.25} />
            </button>
            <span
              id={hintId}
              className="password-field-hint-tooltip"
              role="tooltip"
            >
              {hint}
            </span>
          </span>
        ) : null}
      </div>
      <div className="password-control">
        <Input
          {...props}
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={Boolean(error) || Boolean(props["aria-invalid"])}
          aria-describedby={describedBy || undefined}
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
