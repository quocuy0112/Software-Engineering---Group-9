"use client";
import { useId, useState, type InputHTMLAttributes } from "react";
import { Info } from "lucide-react";
import { Input } from "@/frontend/components/ui/input";
import { PasswordVisibilityButton } from "@/frontend/components/ui/password-visibility-button";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { authCopy } from "./auth-copy";

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
  const copy = authCopy(useWorkspaceLocale());
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
              aria-label={copy.common.passwordRequirements(label)}
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
          label={visible ? copy.common.hidePassword : copy.common.showPassword}
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
