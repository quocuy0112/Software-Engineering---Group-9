"use client";

export function ImageSearchConsent({
  selected,
  onChange,
}: {
  selected: boolean;
  onChange(selected: boolean): void;
}) {
  return (
    <fieldset>
      <legend>Optional external interpretation</legend>
      <label>
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onChange(event.target.checked)}
        />
        Send recognized text only to the approved OpenAI model for this
        job-filter purpose.
      </label>
      <p>
        Initially off. Refusing or revoking keeps local/manual search available.
      </p>
    </fieldset>
  );
}
