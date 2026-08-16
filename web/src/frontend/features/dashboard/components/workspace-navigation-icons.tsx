export type WorkspaceNavIconName =
  | "dashboard"
  | "jobs"
  | "candidates"
  | "messages"
  | "connections"
  | "support"
  | "profile"
  | "settings"
  | "signout";

export function WorkspaceNavIcon({ name }: { name: WorkspaceNavIconName }) {
  if (name === "signout") {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="nav-icon">
        <path d="M8 4H4.5A1.5 1.5 0 0 0 3 5.5v9A1.5 1.5 0 0 0 4.5 16H8" />
        <path d="M11 6.5 14.5 10 11 13.5M7 10h7.5" />
      </svg>
    );
  }

  if (name === "profile") {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="nav-icon">
        <circle cx="10" cy="6.5" r="3" />
        <path d="M4 17c.7-3.2 2.7-4.8 6-4.8s5.3 1.6 6 4.8" />
      </svg>
    );
  }

  if (name === "jobs") {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="nav-icon">
        <rect x="3" y="6" width="14" height="10" rx="2" />
        <path d="M7 6V4.8C7 3.8 7.8 3 8.8 3h2.4c1 0 1.8.8 1.8 1.8V6M3 10h14M8 10v1h4v-1" />
      </svg>
    );
  }

  if (name === "messages") {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="nav-icon">
        <path d="M3 4.5h14v9H8l-4 3v-3H3z" />
        <path d="M6 8h8M6 10.5h5" />
      </svg>
    );
  }

  if (name === "support") {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="nav-icon">
        <path d="M4 9a6 6 0 0 1 12 0v4a2 2 0 0 1-2 2h-2" />
        <path d="M4 9v3H2V9h2M16 9h2v3h-2M8 16h4" />
      </svg>
    );
  }

  if (name === "connections") {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="nav-icon">
        <circle cx="6" cy="7" r="2.5" />
        <circle cx="14" cy="7" r="2.5" />
        <path d="M2.5 16c.4-3 1.6-4.5 3.5-4.5S9.1 13 9.5 16M10.5 16c.4-3 1.6-4.5 3.5-4.5s3.1 1.5 3.5 4.5M8.5 8.5h3" />
      </svg>
    );
  }

  if (name === "candidates") {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="nav-icon">
        <circle cx="7" cy="6.5" r="2.5" />
        <circle cx="14.5" cy="7.5" r="2" />
        <path d="M2.5 16c.4-3.1 1.9-4.7 4.5-4.7s4.1 1.6 4.5 4.7M12 12.3c2.4-.5 4.4.8 5 3.7" />
      </svg>
    );
  }

  if (name === "settings") {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="nav-icon">
        <circle cx="10" cy="10" r="2.7" />
        <path d="M17.3 12.1a7.5 7.5 0 0 0 0-4.2l1.2-.9-1.5-2.6-1.4.6a7.4 7.4 0 0 0-3.6-2.1L11.8 1H8.2l-.2 1.9a7.4 7.4 0 0 0-3.6 2.1L3 4.4 1.5 7l1.2.9a7.5 7.5 0 0 0 0 4.2l-1.2.9L3 15.6l1.4-.6a7.4 7.4 0 0 0 3.6 2.1l.2 1.9h3.6l.2-1.9a7.4 7.4 0 0 0 3.6-2.1l1.4.6 1.5-2.6z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="nav-icon">
      <rect x="3" y="3" width="5" height="5" rx="1" />
      <rect x="12" y="3" width="5" height="5" rx="1" />
      <rect x="3" y="12" width="5" height="5" rx="1" />
      <rect x="12" y="12" width="5" height="5" rx="1" />
    </svg>
  );
}
