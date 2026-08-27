"use client";

export default function CompanyDetailError({ reset }: { reset: () => void }) {
  return (
    <main role="alert">
      <h1>Company details could not be loaded</h1>
      <p>This company may no longer be publicly available.</p>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
