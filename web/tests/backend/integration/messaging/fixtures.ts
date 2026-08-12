import { randomUUID } from "node:crypto";
import { prisma } from "@/backend/database/prisma";

export async function seedMessagingFixture(now = new Date()) {
  const prefix = `messaging-${randomUUID()}`;
  const candidateId = `${prefix}-candidate`;
  const recruiterId = `${prefix}-recruiter`;
  const outsiderId = `${prefix}-outsider`;
  const companyId = `${prefix}-company`;
  const otherCompanyId = `${prefix}-other-company`;
  const jobId = `${prefix}-job`;
  const cvId = `${prefix}-cv`;
  const applicationId = `${prefix}-application`;

  await prisma.$transaction(async (tx) => {
    for (const [id, name] of [
      [candidateId, "Messaging Candidate"],
      [recruiterId, "Messaging Recruiter"],
      [outsiderId, "Messaging Outsider"],
    ] as const) {
      await tx.userAccount.create({
        data: {
          id,
          name,
          email: `${id}@example.test`,
          normalizedEmail: `${id}@example.test`,
          emailVerified: true,
          state: "ACTIVE",
          stateChangedAt: now,
          candidateIdentity: {
            create: {
              profile: {
                create: {
                  headline: "Messaging fixture participant",
                  summary: "A disposable profile for realtime messaging tests.",
                },
              },
            },
          },
        },
      });
    }
    await tx.company.createMany({
      data: [
        {
          id: companyId,
          slug: `${prefix}-company`,
          legalName: "Messaging Company Ltd",
          displayName: "Messaging Company",
          verificationState: "ACTIVE",
          verifiedAt: now,
        },
        {
          id: otherCompanyId,
          slug: `${prefix}-other-company`,
          legalName: "Other Company Ltd",
          displayName: "Other Company",
          verificationState: "ACTIVE",
          verifiedAt: now,
        },
      ],
    });
    await tx.companyMembership.createMany({
      data: [
        {
          companyId,
          userId: recruiterId,
          role: "RECRUITER",
          status: "ACTIVE",
          priorApprovedRole: "RECRUITER",
        },
        {
          companyId: otherCompanyId,
          userId: recruiterId,
          role: "RECRUITER",
          status: "ACTIVE",
          priorApprovedRole: "RECRUITER",
        },
      ],
    });
    await tx.jobPosting.create({
      data: {
        id: jobId,
        companyId,
        slug: `${prefix}-job`,
        title: "Messaging Test Job",
        normalizedTitle: "messaging test job",
        summary: "A deterministic fixture job.",
        description: "A deterministic fixture job for messaging tests.",
        responsibilities: "Exchange professional messages.",
        requirements: "Use the messaging test fixture.",
        location: "Ho Chi Minh City",
        normalizedLocation: "ho chi minh city",
        employmentType: "FULL_TIME",
        experienceLevel: "ENTRY",
        workArrangement: "HYBRID",
        searchDocumentNormalized: "messaging test job ho chi minh city",
        status: "ACTIVE",
        approvedAt: now,
        publishedAt: now,
      },
    });
    await tx.candidateCv.create({
      data: {
        id: cvId,
        candidateUserId: candidateId,
        displayName: "Messaging fixture CV",
        fileName: "fixture.pdf",
        mimeType: "application/pdf",
        byteSize: 128,
        storageKey: `${prefix}/fixture.pdf`,
        checksumSha256: "0".repeat(64),
        confirmedAt: now,
      },
    });
    await tx.jobApplication.create({
      data: {
        id: applicationId,
        candidateUserId: candidateId,
        jobPostingId: jobId,
        selectedCvId: cvId,
        profileSnapshot: {},
        cvSnapshot: {},
        jobSnapshot: {},
        consentVersion: "messaging-fixture-v1",
        consentedAt: now,
        idempotencyKey: randomUUID(),
        submissionBindingDigest: "1".repeat(64),
        submittedAt: now,
      },
    });
    await tx.professionalConnection.create({
      data: {
        id: `${prefix}-connection`,
        participantLowId: [candidateId, recruiterId].sort()[0]!,
        participantHighId: [candidateId, recruiterId].sort()[1]!,
        acceptedAt: now,
      },
    });
  });

  return {
    prefix,
    candidateId,
    recruiterId,
    outsiderId,
    companyId,
    otherCompanyId,
    jobId,
    applicationId,
    connectionId: `${prefix}-connection`,
  };
}

export async function cleanupMessagingFixture(prefix: string) {
  const userIds = (
    await prisma.userAccount.findMany({
      where: { id: { startsWith: prefix } },
      select: { id: true },
    })
  ).map((row) => row.id);
  const conversationIds = (
    await prisma.messagingConversation.findMany({
      where: {
        OR: [
          { participantLowId: { in: userIds } },
          { participantHighId: { in: userIds } },
        ],
      },
      select: { id: true },
    })
  ).map((row) => row.id);
  await prisma.$transaction([
    prisma.messagingReport.deleteMany({
      where: {
        OR: [
          { reporterUserId: { in: userIds } },
          { targetUserId: { in: userIds } },
          { conversationId: { in: conversationIds } },
        ],
      },
    }),
    prisma.messagingMessage.deleteMany({
      where: { conversationId: { in: conversationIds } },
    }),
    prisma.messagingConversationParticipant.deleteMany({
      where: { conversationId: { in: conversationIds } },
    }),
    prisma.messagingConversation.deleteMany({
      where: { id: { in: conversationIds } },
    }),
    prisma.userMessagingBlock.deleteMany({
      where: {
        OR: [{ blockerUserId: { in: userIds } }, { blockedUserId: { in: userIds } }],
      },
    }),
    prisma.professionalConnection.deleteMany({
      where: {
        OR: [
          { participantLowId: { in: userIds } },
          { participantHighId: { in: userIds } },
        ],
      },
    }),
    prisma.jobApplication.deleteMany({
      where: { candidateUserId: { in: userIds } },
    }),
    prisma.candidateCv.deleteMany({
      where: { candidateUserId: { in: userIds } },
    }),
    prisma.jobPosting.deleteMany({ where: { id: { startsWith: prefix } } }),
    prisma.companyMembership.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.company.deleteMany({ where: { id: { startsWith: prefix } } }),
    prisma.authProviderAccount.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.session.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.candidateIdentity.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.userAccount.deleteMany({ where: { id: { in: userIds } } }),
  ]);
}
