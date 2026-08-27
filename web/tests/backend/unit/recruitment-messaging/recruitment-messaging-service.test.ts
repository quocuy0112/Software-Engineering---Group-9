import { describe, expect, it, vi } from "vitest";

import { RecruitmentMessagingService } from "@/backend/recruitment-messaging/recruitment-messaging-service";

const createdAt = new Date("2026-08-27T00:00:00.000Z");

function makeThread(overrides: Record<string, unknown> = {}) {
  return {
    id: "thread-1",
    applicationId: "application-1",
    companyId: "company-1",
    jobPostingId: "job-1",
    candidateUserId: "candidate-1",
    state: "OPEN",
    nextMessageSequence: 1,
    lastMessageSequence: null,
    lastMessageAt: null,
    candidateLastReadSequence: 0,
    staffLastReadSequence: 0,
    application: {
      id: "application-1",
      stage: "VIEWED",
      candidateUserId: "candidate-1",
      jobPosting: {
        id: "job-1",
        title: "Frontend Engineer",
        companyId: "company-1",
        company: { displayName: "Example Company" },
      },
      candidate: {
        user: {
          name: "Candidate",
          image: null,
          state: "ACTIVE",
          deletedAt: null,
        },
      },
    },
    assignedMembership: {
      id: "recruiter-membership",
      userId: "recruiter-1",
      role: "RECRUITER",
      status: "ACTIVE",
      user: {
        name: "Recruiter",
        image: null,
        state: "ACTIVE",
        deletedAt: null,
      },
    },
    ...overrides,
  } as never;
}

function makeSendDatabase({
  actorMembership,
  row,
}: {
  actorMembership: Record<string, unknown>;
  row: ReturnType<typeof makeThread>;
}) {
  const messageCreate = vi.fn().mockResolvedValue({
    id: "message-1",
    threadId: "thread-1",
    senderUserId: actorMembership.userId,
    senderMembershipId: actorMembership.id,
    body: "Hello",
    sequence: 1,
    createdAt,
  });
  const transactionDatabase = {
    recruitmentThread: {
      update: vi
        .fn()
        .mockResolvedValueOnce({ nextMessageSequence: 2 })
        .mockResolvedValueOnce(undefined),
    },
    recruitmentMessage: { create: messageCreate },
  };
  const database = {
    recruitmentThread: {
      findUnique: vi.fn().mockResolvedValue(row),
    },
    companyMembership: {
      findFirst: vi.fn().mockResolvedValue(actorMembership),
    },
    auditEvent: { create: vi.fn().mockResolvedValue(undefined) },
    recruitmentMessage: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi
      .fn()
      .mockImplementation(
        async (
          callback: (transaction: typeof transactionDatabase) => unknown,
        ) => callback(transactionDatabase),
      ),
  } as never;

  return { database, messageCreate };
}

describe("RecruitmentMessagingService permissions", () => {
  it("allows an owner to view and send in a thread assigned to active staff", async () => {
    const { database, messageCreate } = makeSendDatabase({
      actorMembership: {
        id: "owner-membership",
        userId: "owner-1",
        role: "OWNER",
      },
      row: makeThread(),
    });
    const service = new RecruitmentMessagingService(database);

    const detail = await service.detail("thread-1", "owner-1");
    expect(detail.access).toBe("OWNER");
    expect(detail.thread.canSend).toBe(true);

    await service.send("thread-1", "owner-1", {
      content: "Hello",
      clientOperationId: "owner-message-1",
    });

    expect(messageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          senderMembershipId: "owner-membership",
        }),
      }),
    );
  });

  it("keeps owner send disabled when the thread has no staff assignee", async () => {
    const { database } = makeSendDatabase({
      actorMembership: {
        id: "owner-membership",
        userId: "owner-1",
        role: "OWNER",
      },
      row: makeThread({ assignedMembership: null }),
    });
    const service = new RecruitmentMessagingService(database);

    await expect(
      service.send("thread-1", "owner-1", {
        content: "Hello",
        clientOperationId: "owner-message-1",
      }),
    ).rejects.toMatchObject({ code: "NOT_ASSIGNED", status: 403 });
  });

  it("allows an HR manager to assign the thread to themself and send", async () => {
    const hrMembership = {
      id: "hr-membership",
      userId: "hr-1",
      role: "HR_MANAGER",
      status: "ACTIVE",
      user: {
        name: "HR Manager",
        image: null,
        state: "ACTIVE",
        deletedAt: null,
      },
    };
    const selfAssignedThread = makeThread({
      assignedMembership: {
        ...hrMembership,
      },
    });
    const transactionDatabase = {
      recruitmentThread: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue(selfAssignedThread),
      },
      auditEvent: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const database = {
      jobApplication: {
        findUnique: vi.fn().mockResolvedValue({
          id: "application-1",
          candidateUserId: "candidate-1",
          stage: "VIEWED",
          jobPosting: { id: "job-1", companyId: "company-1" },
        }),
      },
      companyMembership: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(hrMembership)
          .mockResolvedValueOnce(hrMembership),
      },
      $transaction: vi
        .fn()
        .mockImplementation(
          async (
            callback: (transaction: typeof transactionDatabase) => unknown,
          ) => callback(transactionDatabase),
        ),
    } as never;
    const service = new RecruitmentMessagingService(database);

    const assigned = await service.assign("application-1", "hr-1", {
      membershipId: "hr-membership",
    });

    expect(assigned.assignee?.userId).toBe("hr-1");
    expect(assigned.assignee?.role).toBe("HR_MANAGER");
    expect(assigned.canSend).toBe(true);
  });

  it("allows an owner to assign a thread to themself when they are the only member", async () => {
    const ownerMembership = {
      id: "owner-membership",
      userId: "owner-1",
      role: "OWNER",
      status: "ACTIVE",
      user: {
        name: "Owner",
        image: null,
        state: "ACTIVE",
        deletedAt: null,
      },
    };
    const selfAssignedThread = makeThread({
      assignedMembership: { ...ownerMembership },
    });
    const transactionDatabase = {
      recruitmentThread: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue(selfAssignedThread),
      },
      auditEvent: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const database = {
      jobApplication: {
        findUnique: vi.fn().mockResolvedValue({
          id: "application-1",
          candidateUserId: "candidate-1",
          stage: "VIEWED",
          jobPosting: { id: "job-1", companyId: "company-1" },
        }),
      },
      companyMembership: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(ownerMembership)
          .mockResolvedValueOnce(ownerMembership),
      },
      $transaction: vi
        .fn()
        .mockImplementation(
          async (
            callback: (transaction: typeof transactionDatabase) => unknown,
          ) => callback(transactionDatabase),
        ),
    } as never;
    const service = new RecruitmentMessagingService(database);

    const assigned = await service.assign("application-1", "owner-1", {
      membershipId: "owner-membership",
    });

    expect(assigned.assignee?.userId).toBe("owner-1");
    expect(assigned.assignee?.role).toBe("OWNER");
    expect(assigned.canSend).toBe(true);
  });

  it("materializes an unthreaded application for an owner-only company", async () => {
    const threadUpsert = vi.fn().mockResolvedValue({});
    const database = {
      companyMembership: {
        findMany: vi.fn().mockResolvedValue([{ companyId: "company-1" }]),
      },
      jobApplication: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "application-1",
            candidateUserId: "candidate-1",
            jobPostingId: "job-1",
            jobPosting: { companyId: "company-1" },
          },
        ]),
      },
      recruitmentThread: {
        upsert: threadUpsert,
        findMany: vi
          .fn()
          .mockResolvedValue([makeThread({ assignedMembership: null })]),
      },
      $transaction: vi.fn().mockResolvedValue([]),
    } as never;
    const service = new RecruitmentMessagingService(database);

    const items = await service.ownerOverview("owner-1", {});

    expect(threadUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { applicationId: "application-1" },
        create: expect.objectContaining({
          companyId: "company-1",
        }),
      }),
    );
    expect(items).toHaveLength(1);
    expect(items[0].canSend).toBe(false);
  });
});
