import "server-only";
import { prisma } from "@/backend/database/prisma";
import {
  accountListItemSchema,
  listEnvelope,
} from "@/shared/contracts/admin/resources";
import { calculationMetadata } from "@/backend/admin/dashboard/dashboard-definition";

function maskEmail(email: string) {
  const [local = "", domain = ""] = email.normalize("NFC").split("@");
  const chars = Array.from(local);
  return `${chars.length < 2 ? "***" : `${chars[0]}***`}@${domain}`;
}

export class AccountListService {
  async list(input: {
    page: number;
    perPage: number;
    filter: Record<string, unknown>;
  }) {
    const now = new Date();
    const search =
      typeof input.filter.q === "string" ? input.filter.q.trim() : "";
    const state =
      typeof input.filter.state === "string" ? input.filter.state : undefined;
    const membershipRole =
      typeof input.filter.membershipRole === "string"
        ? (input.filter.membershipRole as
            | "OWNER"
            | "HR_MANAGER"
            | "RECRUITER"
            | "HIRING_MANAGER")
        : undefined;
    const membershipState =
      typeof input.filter.membershipState === "string"
        ? (input.filter.membershipState as "ACTIVE" | "SUSPENDED" | "REMOVED")
        : undefined;
    const recruiterEnabled =
      typeof input.filter.recruiterEnabled === "boolean"
        ? input.filter.recruiterEnabled
        : undefined;
    const membershipPredicate = {
      ...(membershipRole ? { role: membershipRole } : {}),
      ...(membershipState ? { status: membershipState } : {}),
      ...(recruiterEnabled === true ? { status: "ACTIVE" as const } : {}),
    };
    const hasMembershipFilter =
      membershipRole !== undefined ||
      membershipState !== undefined ||
      recruiterEnabled !== undefined;
    const where = {
      ...(state &&
      ["ACTIVE", "SUSPENDED", "PENDING_VERIFICATION", "DELETED"].includes(state)
        ? {
            state: state as
              | "ACTIVE"
              | "SUSPENDED"
              | "PENDING_VERIFICATION"
              | "DELETED",
          }
        : {}),
      ...(search
        ? {
            OR: [
              { id: search },
              { name: { contains: search, mode: "insensitive" as const } },
              { normalizedEmail: search.toLowerCase() },
            ],
          }
        : {}),
      ...(hasMembershipFilter
        ? {
            companyMemberships:
              recruiterEnabled === false
                ? { none: { status: "ACTIVE" as const } }
                : { some: membershipPredicate },
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.userAccount.findMany({
        where,
        skip: (input.page - 1) * input.perPage,
        take: input.perPage,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        include: {
          candidateIdentity: { select: { userId: true } },
          _count: {
            select: { companyMemberships: { where: { status: "ACTIVE" } } },
          },
          platformAdministratorGrants: {
            where: {
              state: "ACTIVE",
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
            select: { id: true },
            take: 1,
          },
        },
      }),
      prisma.userAccount.count({ where }),
    ]);
    return listEnvelope(accountListItemSchema).parse({
      ...calculationMetadata(now),
      total,
      data: rows.map((row) => ({
        id: row.id,
        displayName: row.name,
        maskedEmail: maskEmail(row.email),
        state: row.state,
        createdAt: row.createdAt.toISOString(),
        hasCandidateIdentity: row.candidateIdentity !== null,
        activeMembershipCount: row._count.companyMemberships,
        hasActiveAdministratorGrant: row.platformAdministratorGrants.length > 0,
      })),
    });
  }
}

export { maskEmail };
