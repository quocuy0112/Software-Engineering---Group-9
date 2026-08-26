type PasswordRequirementChecklistProps = {
  value: string;
};

/** Mirrors PasswordPolicy without sending, storing, or exposing a password. */
export function PasswordRequirementChecklist({
  value,
}: PasswordRequirementChecklistProps) {
  const length = [...value].length;
  const hasUppercase = /\p{Lu}/u.test(value);
  const hasDigit = /\p{N}/u.test(value);
  const hasSpecialCharacter = /[^\p{L}\p{N}\s]/u.test(value);
  const hasNoControlCharacters = !Array.from(value).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 0x1f || code === 0x7f;
  });
  const requirements = [
    { label: "At least 12 characters", met: length >= 12 },
    { label: "No more than 128 characters", met: length <= 128 },
    { label: "1 uppercase letter", met: hasUppercase },
    { label: "1 number", met: hasDigit },
    {
      label: "1 special character",
      met: hasSpecialCharacter,
    },
    { label: "No control characters", met: hasNoControlCharacters },
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
