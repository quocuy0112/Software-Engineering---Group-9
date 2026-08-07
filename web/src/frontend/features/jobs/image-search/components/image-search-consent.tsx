"use client";

export function ImageSearchConsent({
  selected,
  onChange,
}: {
  selected: boolean;
  onChange(selected: boolean): void;
}) {
  return (
    <fieldset className="image-search-consent">
      <legend>Required AI processing consent</legend>
      <label>
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onChange(event.target.checked)}
        />
        I agree that SmartHire may send only the recognized text from this image
        to the approved OpenAI deployment to create editable job-search filters
        for this request.
      </label>
      <p>
        Image search is AI-only. Consent starts off and applies only to this
        request. Ordinary text search remains available without consent.
      </p>
    </fieldset>
  );
}
