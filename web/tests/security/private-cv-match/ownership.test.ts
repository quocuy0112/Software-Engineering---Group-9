import { describe, expect, it } from "vitest";
import { PrivateCvMatchService } from "@/backend/private-cv-match/private-cv-match-service";
import { PrivateCvMatchError } from "@/backend/private-cv-match/private-match-errors";
import type { PrivateCvMatchRepository } from "@/backend/repositories/private-cv-match/prisma-private-cv-match-repository";

function unavailableRepository() {
  return {
    findOwnedCheck: async () => null,
    findCommandReceipt: async () => null,
    revokeOwnedCheck: async () => false,
  } as unknown as PrivateCvMatchRepository;
}

describe("private match ownership boundary", () => {
  it("makes a cross-owner read indistinguishable from not found", async () => {
    const service = new PrivateCvMatchService({ repository: unavailableRepository() });
    await expect(service.get("candidate-a", "pmc-known-to-attacker")).rejects.toMatchObject({
      status: 404,
      code: "UNAVAILABLE",
    } satisfies Partial<PrivateCvMatchError>);
  });

  it("denies delete with the same unavailable response", async () => {
    const service = new PrivateCvMatchService({ repository: unavailableRepository() });
    await expect(service.delete("candidate-a", "pmc-missing")).rejects.toMatchObject({
      status: 404,
      code: "UNAVAILABLE",
    });
  });

  it("denies retry with the same unavailable response", async () => {
    const service = new PrivateCvMatchService({ repository: unavailableRepository() });
    await expect(service.retryAi("candidate-a", "pmc-missing", "retry-key-123456")).rejects.toMatchObject({
      status: 404,
      code: "UNAVAILABLE",
    });
  });
});
