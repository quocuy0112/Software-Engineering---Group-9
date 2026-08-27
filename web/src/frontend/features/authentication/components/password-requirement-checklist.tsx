import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { authCopy } from "./auth-copy";

type PasswordRequirementChecklistProps = {
  value: string;
};

/** Mirrors PasswordPolicy without sending, storing, or exposing a password. */
export function PasswordRequirementChecklist({
  value,
}: PasswordRequirementChecklistProps) {
  const copy = authCopy(useWorkspaceLocale()).passwordRequirements;
  const length = [...value].length;
  const hasUppercase = /\p{Lu}/u.test(value);
  const hasDigit = /\p{N}/u.test(value);
  const hasSpecialCharacter = /[^\p{L}\p{N}\s]/u.test(value);
  const hasNoControlCharacters = !Array.from(value).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 0x1f || code === 0x7f;
  });
  const requirements = [
    { label: copy.atLeast, met: length >= 12 },
    { label: copy.atMost, met: length <= 128 },
    { label: copy.uppercase, met: hasUppercase },
    { label: copy.number, met: hasDigit },
    {
      label: copy.special,
      met: hasSpecialCharacter,
    },
    { label: copy.control, met: hasNoControlCharacters },
  ];

  return (
    <ul className="password-requirement-checklist" aria-live="polite">
      {requirements.map((requirement) => (
        <li key={requirement.label} data-met={requirement.met}>
          <span aria-hidden="true">✓</span>
          {requirement.label}
        </li>
      ))}
    </ul>
  );
}
