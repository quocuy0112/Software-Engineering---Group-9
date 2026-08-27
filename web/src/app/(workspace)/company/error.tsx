"use client";

export default function CompanyError({ reset }: { reset: () => void }) {
  return (
    <main role="alert">
      <h1>Companies could not be loaded</h1>
      <p>Try again in a moment.</p>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
