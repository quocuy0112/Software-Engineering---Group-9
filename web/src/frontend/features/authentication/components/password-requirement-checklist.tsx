type PasswordRequirementChecklistProps = {
  value: string;
};

/** Mirrors the public registration policy: 12–128 characters. */
export function PasswordRequirementChecklist({
  value,
}: PasswordRequirementChecklistProps) {
  const length = [...value].length;
  const hasUppercase = /\p{Lu}/u.test(value);
  const hasDigit = /\p{N}/u.test(value);
  const hasSpecialCharacter = /[^\p{L}\p{N}\s]/u.test(value);
  const requirements = [
    { label: "No more than 128 characters", met: length <= 128 },
    { label: "At least 12 characters", met: length >= 12 },
    { label: "1 uppercase letter", met: hasUppercase },
    { label: "1 number", met: hasDigit },
    {
      label: "1 special character",
      met: hasSpecialCharacter,
    },
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
