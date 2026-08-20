import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { prisma } from "@/backend/database/prisma";
import { RecruitmentMessagingService } from "@/backend/recruitment-messaging/recruitment-messaging-service";
import { RecruitmentMessagingWorkspace } from "@/frontend/features/recruitment-messaging/recruitment-messaging-workspace";
import "@/frontend/features/recruitment-messaging/recruitment-messaging.css";

export const dynamic = "force-dynamic";

export default async function RecruiterMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Frecruiter%2Fmessages");
  const ownerMembership = await prisma.companyMembership.findFirst({
    where: {
      userId: context.userId,
      role: "OWNER",
      status: "ACTIVE",
      removedAt: null,
    },
    select: { id: true },
  });
  const messaging = new RecruitmentMessagingService();
  const ownerOversight = Boolean(ownerMembership);
  const items = ownerOversight
    ? await messaging.ownerOverview(context.userId, {})
    : await messaging.list(context.userId, { assignment: "mine" });
  return (
    <RecruitmentMessagingWorkspace
      csrfProof={context.csrfProof}
      initialItems={items}
      initialThreadId={(await searchParams).thread ?? null}
      ownerOversight={ownerOversight}
    />
  );
}
