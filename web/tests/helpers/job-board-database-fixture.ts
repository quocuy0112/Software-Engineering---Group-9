import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/backend/database/prisma";
import { normalizeSearchText } from "@/backend/services/jobs/search-normalization";

export type JobBoardDatabaseFixture = Awaited<
  ReturnType<typeof createJobBoardDatabaseFixture>
>;
const checksum = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

export async function createJobBoardDatabaseFixture(
  label = "job-board",
  now = new Date("2026-08-01T08:00:00.000Z"),
) {
  const suffix = randomUUID();
  const userIds = [`job-${label}-a-${suffix}`, `job-${label}-b-${suffix}`];
  const company = await prisma.company.create({
    data: {
      id: `company-${suffix}`,
      slug: `smart-hire-${suffix}`,
      legalName: "SmartHire Test Company Limited",
      displayName: "SmartHire Test",
      publicDescription: "A disposable company used by integration tests.",
      publicLocation: "Hồ Chí Minh",
      verifiedAt: new Date(now.getTime() - 30 * 24 * 60 * 60_000),
      verificationState: "ACTIVE",
    },
  });

  for (const [index, userId] of userIds.entries()) {
    const email = `${userId}@example.test`;
    await prisma.userAccount.create({
      data: {
        id: userId,
        name: `Job Candidate ${index + 1}`,
        email,
        normalizedEmail: email,
        emailVerified: true,
        state: "ACTIVE",
        candidateIdentity: {
          create: {
            profile: {
              create: {
                headline: "TypeScript Engineer",
                location: "Hồ Chí Minh",
                summary: "Builds accessible recruitment products.",
              },
            },
            cvs: {
              create: [
                {
                  id: `cv-confirmed-${index}-${suffix}`,
                  displayName: "Confirmed CV",
                  fileName: "candidate.pdf",
                  mimeType: "application/pdf",
                  byteSize: 32_000,
                  storageKey: `fixtures/${suffix}/${index}/confirmed.pdf`,
                  checksumSha256: checksum(`${suffix}:${index}:confirmed`),
                  confirmedAt: now,
                },
                {
                  id: `cv-unconfirmed-${index}-${suffix}`,
                  displayName: "Unconfirmed CV",
                  fileName: "draft.pdf",
                  mimeType: "application/pdf",
                  byteSize: 16_000,
                  storageKey: `fixtures/${suffix}/${index}/draft.pdf`,
                  checksumSha256: checksum(`${suffix}:${index}:draft`),
                },
              ],
            },
          },
        },
      },
    });
  }

  let skill = await prisma.skill.findUnique({
    where: { normalizedName: "typescript" },
  });
  if (!skill) {
    try {
      skill = await prisma.skill.create({
        data: {
          id: `skill-${suffix}`,
          name: "TypeScript",
          normalizedName: "typescript",
        },
      });
    } catch (error) {
      skill = await prisma.skill.findUnique({
        where: { normalizedName: "typescript" },
      });
      if (!skill) throw error;
    }
  }
  const sharedSkill = skill;
  const base = {
    companyId: company.id,
    summary: "Build useful and accessible recruitment products.",
    description:
      "Create production-grade web experiences for Vietnamese users.",
    responsibilities: "Design, implement, test, and review product increments.",
    requirements: "Strong TypeScript fundamentals and collaborative delivery.",
    benefits: "Flexible work and a learning budget.",
    employmentType: "FULL_TIME" as const,
    experienceLevel: "MID" as const,
    workArrangement: "HYBRID" as const,
    salaryMin: 25_000_000,
    salaryMax: 45_000_000,
    salaryCurrency: "VND",
    salaryPeriod: "MONTH" as const,
    approvedAt: new Date(now.getTime() - 14 * 24 * 60 * 60_000),
    version: 1,
  };

  async function createJob(input: {
    key: string;
    title: string;
    location: string;
    status: "ACTIVE" | "CLOSED" | "EXPIRED" | "PENDING_REVIEW" | "REMOVED";
    publishedAt: Date;
    applicationDeadline?: Date | null;
  }) {
    return prisma.jobPosting.create({
      data: {
        ...base,
        id: `job-${input.key}-${suffix}`,
        slug: `${input.key}-${suffix}`,
        title: input.title,
        normalizedTitle: normalizeSearchText(input.title),
        location: input.location,
        normalizedLocation: normalizeSearchText(input.location),
        searchDocumentNormalized: normalizeSearchText(
          `${input.title} ${company.displayName} ${input.location} TypeScript ${base.description}`,
          60_000,
        ),
        status: input.status,
        publishedAt: input.publishedAt,
        applicationDeadline: input.applicationDeadline ?? null,
        closedAt:
          input.status === "CLOSED" || input.status === "EXPIRED" ? now : null,
        removedAt: input.status === "REMOVED" ? now : null,
        skills: {
          create: {
            skillId: sharedSkill.id,
            displayName: "TypeScript",
            required: true,
            position: 0,
          },
        },
        questions:
          input.key === "active"
            ? {
                create: [
                  {
                    id: `question-text-${suffix}`,
                    prompt:
                      "How many years of relevant experience do you have?",
                    kind: "TEXT",
                    required: true,
                    position: 0,
                  },
                  {
                    id: `question-boolean-${suffix}`,
                    prompt: "Can you work in a hybrid arrangement?",
                    kind: "BOOLEAN",
                    required: true,
                    position: 1,
                  },
                ],
              }
            : undefined,
      },
      include: { questions: true, skills: true },
    });
  }

  const jobs = {
    active: await createJob({
      key: "active",
      title: "Lập trình viên TypeScript",
      location: "Hồ Chí Minh",
      status: "ACTIVE",
      publishedAt: new Date(now.getTime() - 2 * 24 * 60 * 60_000),
      applicationDeadline: new Date(now.getTime() + 14 * 24 * 60 * 60_000),
    }),
    activeSecond: await createJob({
      key: "active-second",
      title: "Kỹ sư Phần mềm",
      location: "Đà Nẵng",
      status: "ACTIVE",
      publishedAt: new Date(now.getTime() - 24 * 60 * 60_000),
      applicationDeadline: new Date(now.getTime() + 21 * 24 * 60 * 60_000),
    }),
    closed: await createJob({
      key: "closed",
      title: "Closed Engineer",
      location: "Hà Nội",
      status: "CLOSED",
      publishedAt: new Date(now.getTime() - 20 * 24 * 60 * 60_000),
    }),
    expired: await createJob({
      key: "expired",
      title: "Expired Engineer",
      location: "Hà Nội",
      status: "EXPIRED",
      publishedAt: new Date(now.getTime() - 30 * 24 * 60 * 60_000),
      applicationDeadline: new Date(now.getTime() - 24 * 60 * 60_000),
    }),
    pending: await createJob({
      key: "pending",
      title: "Pending Engineer",
      location: "Huế",
      status: "PENDING_REVIEW",
      publishedAt: new Date(now.getTime() - 24 * 60 * 60_000),
    }),
    removed: await createJob({
      key: "removed",
      title: "Removed Engineer",
      location: "Cần Thơ",
      status: "REMOVED",
      publishedAt: new Date(now.getTime() - 24 * 60 * 60_000),
    }),
    future: await createJob({
      key: "future",
      title: "Future Engineer",
      location: "Hải Phòng",
      status: "ACTIVE",
      publishedAt: new Date(now.getTime() + 24 * 60 * 60_000),
    }),
  };

  return {
    now,
    suffix,
    company,
    userIds,
    confirmedCvIds: userIds.map(
      (_, index) => `cv-confirmed-${index}-${suffix}`,
    ),
    unconfirmedCvIds: userIds.map(
      (_, index) => `cv-unconfirmed-${index}-${suffix}`,
    ),
    jobs,
  };
}

export async function deleteJobBoardDatabaseFixture(
  fixture: Pick<JobBoardDatabaseFixture, "company" | "userIds" | "suffix">,
) {
  const jobIds = (
    await prisma.jobPosting.findMany({
      where: { companyId: fixture.company.id },
      select: { id: true },
    })
  ).map((job) => job.id);
  const applicationIds = (
    await prisma.jobApplication.findMany({
      where: { jobPostingId: { in: jobIds } },
      select: { id: true },
    })
  ).map((application) => application.id);
  await prisma.recruitmentNotificationWork.deleteMany({
    where: { applicationId: { in: applicationIds } },
  });
  await prisma.emailOutbox.deleteMany({
    where: { userId: { in: fixture.userIds } },
  });
  await prisma.moderationReport.deleteMany({
    where: {
      OR: [
        { reporterUserId: { in: fixture.userIds } },
        { jobReference: { in: jobIds } },
        { applicationReference: { in: applicationIds } },
      ],
    },
  });
  await prisma.applicationAnswer.deleteMany({
    where: { applicationId: { in: applicationIds } },
  });
  await prisma.jobApplication.deleteMany({
    where: { id: { in: applicationIds } },
  });
  await prisma.jobReport.deleteMany({
    where: { jobPostingId: { in: jobIds } },
  });
  await prisma.savedJob.deleteMany({ where: { jobPostingId: { in: jobIds } } });
  await prisma.candidateCv.deleteMany({
    where: { candidateUserId: { in: fixture.userIds } },
  });
  await prisma.applicationQuestion.deleteMany({
    where: { jobPostingId: { in: jobIds } },
  });
  await prisma.jobPostingSkill.deleteMany({
    where: { jobPostingId: { in: jobIds } },
  });
  await prisma.applicationArtifactPromotion.deleteMany({
    where: { jobPostingId: { in: jobIds } },
  });
  await prisma.jobPosting.deleteMany({ where: { id: { in: jobIds } } });
  await prisma.company.deleteMany({ where: { id: fixture.company.id } });
  await prisma.candidateIdentity.deleteMany({
    where: { userId: { in: fixture.userIds } },
  });
  await prisma.userAccount.deleteMany({
    where: { id: { in: fixture.userIds } },
  });
}
