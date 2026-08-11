import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminWorkerRuntime } from "@/backend/admin/workers/admin-worker-runtime";
import { prisma } from "@/backend/database/prisma";
import { runEvidenceSafetyCycle } from "@/backend/admin/workers/verification-lifecycle-loop";
import { runRationaleRetentionCycle } from "@/backend/admin/workers/rationale-retention-loop";

describe("admin worker loop isolation", () => {
  afterEach(async () => {
    vi.useRealTimers();
    await prisma.businessLicenseEvidence.deleteMany({
      where: { requestId: { startsWith: "worker-resilience:" } },
    });
    await prisma.recruiterVerificationRequest.deleteMany({
      where: { id: { startsWith: "worker-resilience:" } },
    });
    await prisma.userAccount.deleteMany({
      where: { id: { startsWith: "worker-resilience:" } },
    });
    await prisma.privilegedActionRationale.deleteMany({
      where: { correlationId: { startsWith: "worker-resilience:" } },
    });
  });

  it("reports each loop independently during a partial provider outage", async () => {
    const runtime = new AdminWorkerRuntime([
      { name: "snapshot", intervalMs: 30_000, run: async () => ({ ok: true }) },
      {
        name: "evidence",
        intervalMs: 5_000,
        run: async () => {
          throw new Error("scanner unavailable");
        },
      },
      {
        name: "notification",
        intervalMs: 30_000,
        run: async () => ({ ok: true }),
      },
    ]);
    expect(await runtime.probe(new Date())).toEqual([
      { name: "snapshot", ready: true },
      { name: "evidence", ready: false },
      { name: "notification", ready: true },
    ]);
  });

  it("stops cleanly and restarts every independent interval", async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const runtime = new AdminWorkerRuntime([
      {
        name: "snapshot",
        intervalMs: 1_000,
        run: async () => calls.push("snapshot"),
      },
      {
        name: "retention",
        intervalMs: 2_000,
        run: async () => calls.push("retention"),
      },
    ]);

    runtime.start();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(calls).toEqual(["snapshot", "snapshot", "retention"]);
    runtime.stop();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(calls).toHaveLength(3);

    runtime.start();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(calls).toEqual([
      "snapshot",
      "snapshot",
      "retention",
      "snapshot",
      "snapshot",
      "retention",
    ]);
    runtime.stop();
  });

  it("reclaims an expired evidence lease after a worker restart", async () => {
    const suffix = crypto.randomUUID();
    const userId = `worker-resilience:user:${suffix}`;
    const requestId = `worker-resilience:request:${suffix}`;
    const evidenceId = `worker-resilience:evidence:${suffix}`;
    const firstRun = new Date("2026-08-10T09:00:00.000Z");
    await prisma.userAccount.create({
      data: {
        id: userId,
        name: "Worker Resilience",
        email: `${suffix}@worker.invalid`,
        normalizedEmail: `${suffix}@worker.invalid`,
        emailVerified: true,
        state: "ACTIVE",
      },
    });
    await prisma.recruiterVerificationRequest.create({
      data: {
        id: requestId,
        applicantUserId: userId,
        submittedCompanyName: "Worker Resilience Co",
        normalizedTaxIdentifier: "0312345678",
        requestedRole: "RECRUITER",
        state: "PENDING_CHECKS",
      },
    });
    await prisma.businessLicenseEvidence.create({
      data: {
        id: evidenceId,
        requestId,
        submissionVersion: 1,
        declaredMediaType: "application/pdf",
        byteSize: 16,
        sourceSha256: "0".repeat(64),
        storageAdapter: "filesystem",
        storageLocator: "intentionally-missing",
        encryptionKeyVersion: 1,
        iv: "test",
        authenticationTag: "test",
        processingLeaseOwner: "crashed-worker",
        processingLeaseExpiry: new Date(firstRun.getTime() - 1),
      },
    });
    await prisma.recruiterVerificationRequest.update({
      where: { id: requestId },
      data: { currentEvidenceId: evidenceId },
    });

    await runEvidenceSafetyCycle(firstRun, 1);
    const firstLease = await prisma.businessLicenseEvidence.findUniqueOrThrow({
      where: { id: evidenceId },
    });
    expect(firstLease.processingLeaseOwner).toMatch(/^evidence:/u);
    expect(firstLease.processingLeaseExpiry).toEqual(
      new Date(firstRun.getTime() + 60_000),
    );

    await runEvidenceSafetyCycle(new Date(firstRun.getTime() + 60_001), 1);
    const reclaimed = await prisma.businessLicenseEvidence.findUniqueOrThrow({
      where: { id: evidenceId },
    });
    expect(reclaimed.processingLeaseOwner).toMatch(/^evidence:/u);
    expect(reclaimed.processingLeaseOwner).not.toBe(
      firstLease.processingLeaseOwner,
    );
  });

  it("reconciles due rationale retention idempotently after interruption", async () => {
    const now = new Date("2026-08-10T09:00:00.000Z");
    const correlationId = `worker-resilience:${crypto.randomUUID()}`;
    const row = await prisma.privilegedActionRationale.create({
      data: {
        correlationId,
        ciphertext: "encrypted",
        iv: "iv",
        authenticationTag: "tag",
        encryptionKeyVersion: 1,
        inaccessibleAt: new Date(now.getTime() - 86_400_000),
        deleteAfter: new Date(now.getTime() - 1),
      },
    });

    await expect(runRationaleRetentionCycle(now)).resolves.toEqual({
      deleted: 1,
    });
    await expect(runRationaleRetentionCycle(now)).resolves.toEqual({
      deleted: 0,
    });
    await expect(
      prisma.privilegedActionRationale.findUniqueOrThrow({
        where: { id: row.id },
        select: { ciphertext: true, iv: true, authenticationTag: true, deletedAt: true },
      }),
    ).resolves.toMatchObject({
      ciphertext: "",
      iv: "",
      authenticationTag: "",
      deletedAt: now,
    });
  });
});
