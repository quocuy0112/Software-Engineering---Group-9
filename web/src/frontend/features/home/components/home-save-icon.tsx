export function HomeSaveIcon({ saved = false }: { saved?: boolean }) {
  return (
    <svg
      className={["home-save-icon", saved && "home-save-icon--saved"]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
      viewBox="0 0 24 24"
    >
      <path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.8L6 21V4.75Z" />
    </svg>
  );
}
