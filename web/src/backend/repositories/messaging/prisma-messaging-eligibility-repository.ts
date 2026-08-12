import "server-only";
import { prisma } from "@/backend/database/prisma";
import type {
  EligibleContext,
  SafeParticipant,
} from "@/shared/contracts/messaging/common";
import type { EligibleParticipant } from "@/shared/contracts/messaging/conversations";

const recruitingRoles = ["OWNER", "HR_MANAGER", "RECRUITER", "HIRING_MANAGER"] as const;

type EligiblePage = { items: EligibleParticipant[]; nextCursor: string | null };

function pushContext(
  rows: Map<string, EligibleParticipant>,
  participant: SafeParticipant,
  context: EligibleContext,
) {
  const row = rows.get(participant.id) ?? { participant, contexts: [] };
  if (!row.contexts.some((candidate) => candidate.reference === context.reference)) {
    row.contexts.push(context);
  }
  rows.set(participant.id, row);
}

export class PrismaMessagingEligibilityRepository {
  constructor(private readonly db: typeof prisma = prisma) {}

  async list(input: {
    userId: string;
    q?: string;
    cursor?: string;
    limit: number;
  }): Promise<EligiblePage> {
    const query = input.q?.trim();
    const participantFilter = {
      state: "ACTIVE" as const,
      ...(query ? { name: { contains: query, mode: "insensitive" as const } } : {}),
    };
    const [candidateApplications, recruiterApplications, connections] =
      await Promise.all([
        this.db.jobApplication.findMany({
          where: { candidateUserId: input.userId },
          select: {
            id: true,
            jobPosting: {
              select: {
                title: true,
                company: {
                  select: {
                    id: true,
                    displayName: true,
                    memberships: {
                      where: {
                        status: "ACTIVE",
                        role: { in: [...recruitingRoles] },
                        user: participantFilter,
                      },
                      select: { user: { select: { id: true, name: true, image: true } } },
                    },
                  },
                },
              },
            },
          },
        }),
        this.db.jobApplication.findMany({
          where: {
            candidate: { user: participantFilter },
            jobPosting: {
              company: {
                memberships: {
                  some: {
                    userId: input.userId,
                    status: "ACTIVE",
                    role: { in: [...recruitingRoles] },
                  },
                },
              },
            },
          },
          select: {
            id: true,
            candidate: { select: { user: { select: { id: true, name: true, image: true } } } },
            jobPosting: {
              select: {
                title: true,
                company: { select: { id: true, displayName: true } },
              },
            },
          },
        }),
        this.db.professionalConnection.findMany({
          where: {
            state: "ACCEPTED",
            OR: [
              { participantLowId: input.userId, participantHigh: participantFilter },
              { participantHighId: input.userId, participantLow: participantFilter },
            ],
          },
          select: {
            id: true,
            participantLowId: true,
            participantLow: { select: { id: true, name: true, image: true } },
            participantHigh: { select: { id: true, name: true, image: true } },
          },
        }),
      ]);

    const rows = new Map<string, EligibleParticipant>();
    for (const application of candidateApplications) {
      for (const membership of application.jobPosting.company.memberships) {
        pushContext(rows, membership.user, {
          type: "APPLICATION",
          reference: application.id,
          label: application.jobPosting.title,
          companyName: application.jobPosting.company.displayName,
          jobTitle: application.jobPosting.title,
        });
      }
    }
    for (const application of recruiterApplications) {
      pushContext(rows, application.candidate.user, {
        type: "APPLICATION",
        reference: application.id,
        label: application.jobPosting.title,
        companyName: application.jobPosting.company.displayName,
        jobTitle: application.jobPosting.title,
      });
    }
    for (const connection of connections) {
      const participant =
        connection.participantLowId === input.userId
          ? connection.participantHigh
          : connection.participantLow;
      pushContext(rows, participant, {
        type: "PROFESSIONAL_CONNECTION",
        reference: connection.id,
        label: "Professional connection",
        companyName: null,
        jobTitle: null,
      });
    }

    const ordered = [...rows.values()].sort((a, b) =>
      a.participant.id.localeCompare(b.participant.id),
    );
    const afterCursor = input.cursor
      ? ordered.filter((item) => item.participant.id > input.cursor!)
      : ordered;
    const page = afterCursor.slice(0, input.limit);
    return {
      items: page,
      nextCursor:
        afterCursor.length > input.limit
          ? (page.at(-1)?.participant.id ?? null)
          : null,
    };
  }

  async findEligibleProfile(userId: string, targetUserId: string) {
    const page = await this.list({ userId, q: undefined, limit: 10_000 });
    return page.items.find((item) => item.participant.id === targetUserId) ?? null;
  }
}
