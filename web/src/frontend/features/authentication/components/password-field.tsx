"use client";
import { useId, useState, type InputHTMLAttributes } from "react";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";

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
        <Button
          className="secondary-action"
          variant="secondary"
          size="icon"
          aria-label={`${visible ? "Hide" : "Show"} password`}
          title={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-controls={id}
          aria-pressed={visible}
          onClick={() => setVisible((value) => !value)}
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d={
                visible
                  ? "M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.7 10.7 0 0 1 12 4c5.1 0 8.5 4 9.5 8a12.5 12.5 0 0 1-2.1 4.1M6.2 6.2C3.9 7.8 2.7 10.2 2.5 12c.3 2.1 1.9 5.3 5.9 7.2"
                  : "M2.5 12S6 4 12 4s9.5 8 9.5 8-3.5 8-9.5 8-9.5-8-9.5-8Zm9.5-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
              }
            />
          </svg>
        </Button>
      </div>
      {error ? (
        <p id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
