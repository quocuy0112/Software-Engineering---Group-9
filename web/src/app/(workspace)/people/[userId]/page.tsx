import { notFound, redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { prisma } from "@/backend/database/prisma";
import { PrismaMessagingEligibilityRepository } from "@/backend/repositories/messaging/prisma-messaging-eligibility-repository";
import { PublicProfessionalProfile } from "@/frontend/features/profile/components/public-professional-profile";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const workspace = await getWorkspaceContext();
  if (!workspace) redirect("/login");
  const { userId } = await params;
  const eligible = await new PrismaMessagingEligibilityRepository().findEligibleProfile(
    workspace.userId,
    userId,
  );
  if (!eligible) notFound();
  const account = await prisma.userAccount.findFirst({
    where: { id: userId, state: "ACTIVE" },
    select: {
      candidateIdentity: {
        select: {
          profile: { select: { headline: true, summary: true, location: true } },
        },
      },
    },
  });
  if (!account) notFound();
  return (
    <PublicProfessionalProfile
      participant={eligible.participant}
      contexts={eligible.contexts}
      profile={account.candidateIdentity?.profile ?? null}
      csrfProof={workspace.csrfProof}
    />
  );
}
