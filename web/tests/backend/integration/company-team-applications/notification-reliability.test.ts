import { describe, expect, it, vi } from "vitest";
import { PrismaOutboxRepository } from "@/backend/repositories/email/outbox-repository";
import { teamApplicationRejectedEmailText } from "@/backend/email/templates/team-application-rejected";

describe("Team Application notification reliability", () => {
  it("uses one stable idempotency key for rejection email retries", async () => {
    const row = {
      kind: "TEAM_APPLICATION_REJECTED" as const,
      recipientRef: "candidate-1",
      recipientCiphertext: null,
      recipientPurpose: null,
      templateVersion: "team-application-rejected.v1",
      payloadRef: { companyName: "Northstar Labs", role: "RECRUITER" },
      idempotencyKey: "team-application-rejected-email:application-1",
    };
    const upsert = vi.fn().mockResolvedValue(row);
    const repository = new PrismaOutboxRepository({
      emailOutbox: {
        upsert,
      },
    } as never);
    const intent = {
      userId: "candidate-1",
      kind: row.kind,
      recipientRef: row.recipientRef,
      templateVersion: row.templateVersion,
      payloadRef: row.payloadRef,
      idempotencyKey: row.idempotencyKey,
    };

    await repository.enqueueIdempotent(intent);
    await repository.enqueueIdempotent(intent);

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          idempotencyKey: "team-application-rejected-email:application-1",
        },
      }),
    );
  });

  it("omits the Owner reason from the neutral rejection email when no reason is provided", () => {
    const text = teamApplicationRejectedEmailText({
      companyName: "Northstar Labs",
      role: "RECRUITER",
      applicationUrl: "https://candidate.example/jobs/applied/team",
    });

    expect(text).toContain("was not selected");
    expect(text).not.toContain("Owner message:");
  });
});
