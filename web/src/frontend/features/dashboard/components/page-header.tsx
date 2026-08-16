import { PageHeader } from "@/frontend/components/layout/page-header";

type WorkspacePageHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  className?: string;
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
  className,
  statusBadge,
}: WorkspacePageHeaderProps) {
  return (
    <PageHeader
      className={
        className
          ? `workspace-page-header ${className}`
          : "workspace-page-header"
      }
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      status={
        statusBadge
          ? {
              label: statusBadge.label,
              tone:
                statusBadge.state === "connected"
                  ? "success"
                  : statusBadge.state === "connecting" ||
                      statusBadge.state === "reconnecting"
                    ? "warning"
                    : "neutral",
              pulsing: statusBadge.state === "connected",
              state: statusBadge.state ?? "offline",
              announce: true,
            }
          : undefined
      }
    />
  );
}
