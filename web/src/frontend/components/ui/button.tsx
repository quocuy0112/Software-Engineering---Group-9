import { forwardRef, type ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "default" | "small" | "icon";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
  }
>(function Button(
  {
    variant = "primary",
    size = "default",
    className = "",
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={[
        "sh-button",
        `sh-button--${variant}`,
        `sh-button--${size}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
});
