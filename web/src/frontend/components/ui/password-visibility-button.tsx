import { Button } from "./button";

type PasswordVisibilityButtonProps = {
  controls: string;
  label: string;
  visible: boolean;
  onClick: () => void;
};

export function PasswordVisibilityButton({
  controls,
  label,
  visible,
  onClick,
}: PasswordVisibilityButtonProps) {
  return (
    <Button
      className="secondary-action password-visibility-button"
      variant="secondary"
      size="icon"
      aria-label={label}
      title={label}
      aria-controls={controls}
      aria-pressed={visible}
      data-visible={visible}
      onClick={onClick}
    >
      <svg
        className="password-visibility-icon"
        viewBox="0 0 24 24"
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
  );
}
