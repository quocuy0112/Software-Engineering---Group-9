export const WORKSPACE_MODE_COOKIE = "smarthire-workspace-mode";

export type WorkspaceMode = "candidate" | "recruiter";

export function parseWorkspaceMode(value: unknown): WorkspaceMode | null {
  return value === "candidate" || value === "recruiter" ? value : null;
}
