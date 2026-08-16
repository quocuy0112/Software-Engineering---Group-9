import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

export const TextField = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & {
    label: ReactNode;
    helperText?: ReactNode;
    error?: ReactNode;
    containerClassName?: string;
  }
>(function TextField(
  { label, helperText, error, containerClassName = "", id, ...props },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const describedBy = error
    ? `${fieldId}-error`
    : helperText
      ? `${fieldId}-help`
      : undefined;

  return (
    <div
      className={["sh-text-field", containerClassName]
        .filter(Boolean)
        .join(" ")}
    >
      <label className="sh-text-field__label" htmlFor={fieldId}>
        {label}
      </label>
      <input
        ref={ref}
        id={fieldId}
        className="sh-input sh-text-field__input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...props}
      />
      {error ? (
        <p className="sh-text-field__error" id={`${fieldId}-error`}>
          {error}
        </p>
      ) : helperText ? (
        <p className="sh-text-field__help" id={`${fieldId}-help`}>
          {helperText}
        </p>
      ) : null}
    </div>
  );
});
