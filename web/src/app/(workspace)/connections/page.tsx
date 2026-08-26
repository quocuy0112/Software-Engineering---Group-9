import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { PrismaConnectionRepository } from "@/backend/repositories/connections/prisma-connection-repository";
import { ConnectionsWorkspace } from "@/frontend/features/connections/components/connections-workspace";
import "@/frontend/features/connections/styles/connections.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Professional Connections | SmartHire" };

export default async function ConnectionsPage() {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Fconnections");
  const repository = new PrismaConnectionRepository();
  const [proposals, connections, notifications] = await Promise.all([
    repository.listParticipant(context.userId, { limit: 50, now: new Date() }),
    repository.listConnections(context.userId, 50),
    repository.listNotifications(context.userId, 50),
  ]);
  return <ConnectionsWorkspace csrfProof={context.csrfProof} currentUserId={context.userId} initialProposals={proposals.items} initialConnections={connections.items} initialNotifications={notifications.items} />;
}
