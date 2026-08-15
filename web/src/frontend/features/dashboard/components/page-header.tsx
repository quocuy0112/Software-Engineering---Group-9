type WorkspacePageHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  statusBadge?: {
    label: string;
    state?: "connected" | "connecting" | "reconnecting" | "offline";
  };
};

/** A compact, consistent header for utility pages inside a workspace. */
export function WorkspacePageHeader({
  eyebrow,
  title,
  subtitle,
  statusBadge,
}: WorkspacePageHeaderProps) {
  return (
    <header className="workspace-page-header">
      <div>
        <p className="workspace-page-header__eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {subtitle ? (
          <p className="workspace-page-header__subtitle">{subtitle}</p>
        ) : null}
      </div>
      {statusBadge ? (
        <span
          className="workspace-page-header__status"
          data-state={statusBadge.state ?? "offline"}
          role="status"
        >
          <span aria-hidden="true" />
          {statusBadge.label}
        </span>
      ) : null}
    </header>
  );
}
