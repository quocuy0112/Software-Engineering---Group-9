import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/auth/workspace-shell";
import { csrfProof } from "@/lib/security/csrf-proof";
import { requireSession } from "@/server/auth/require-session";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await requireSession(await headers());
  if (!current) redirect("/login?returnTo=%2F");

  return (
    <WorkspaceShell csrfProof={csrfProof(current.sessionId)}>
      {children}
    </WorkspaceShell>
  );
}
