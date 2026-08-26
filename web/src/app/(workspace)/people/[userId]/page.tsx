import { notFound, redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { prisma } from "@/backend/database/prisma";
import { PrismaMessagingEligibilityRepository } from "@/backend/repositories/messaging/prisma-messaging-eligibility-repository";
import { PrismaProfileQueryRepository } from "@/backend/repositories/profile/prisma-profile-query-repository";
import { GetProfileAggregateService } from "@/backend/services/profile/get-profile-aggregate";
import { projectVisibleProfile } from "@/backend/services/profile/profile-visibility-projection";
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
  if (!eligible) {
    const row = await new PrismaProfileQueryRepository().findDiscoverable(userId);
    if (!row || userId === workspace.userId) notFound();
    const visible = projectVisibleProfile({
      userId,
      displayName: row.candidate.user.name,
      image: row.candidate.user.image,
      profile: await new GetProfileAggregateService().execute(userId),
      audience: "candidate",
    });
    return (
      <PublicProfessionalProfile
        participant={{ id: userId, name: visible.displayName, image: visible.image }}
        contexts={[]}
        profile={{
          headline: visible.sections.headline ?? null,
          summary: visible.sections.summary ?? null,
          location: visible.sections.location ?? null,
        }}
        visibleSections={visible.sections}
        csrfProof={workspace.csrfProof}
        canMessage={false}
      />
    );
  }
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
