import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "@/backend/database/prisma";
import { createPostgresBackup } from "./postgres-backup";
import { uploadEncryptedBackup } from "./google-drive-backup";

const CONFIG_ID = "platform";

export class BackupService {
  async settings() {
    return (await prisma.backupConfiguration.findUnique({ where: { id: CONFIG_ID } })) ?? { id: CONFIG_ID, enabled: false, intervalSeconds: 60, version: 0, updatedAt: null };
  }
  async update(input: { enabled: boolean; intervalSeconds: number; actorId: string }) {
    if (!Number.isInteger(input.intervalSeconds) || input.intervalSeconds < 10 || input.intervalSeconds > 86_400) throw new Error("BACKUP_INTERVAL_INVALID");
    return prisma.backupConfiguration.upsert({ where: { id: CONFIG_ID }, create: { id: CONFIG_ID, enabled: input.enabled, intervalSeconds: input.intervalSeconds, updatedByAdminId: input.actorId }, update: { enabled: input.enabled, intervalSeconds: input.intervalSeconds, updatedByAdminId: input.actorId, version: { increment: 1 } } });
  }
  async request(trigger: "MANUAL" | "SCHEDULED", actorId?: string, idempotencyKey?: string) {
    if (actorId && idempotencyKey) {
      const existing = await prisma.backupRun.findUnique({
        where: { requestedById_idempotencyKey: { requestedById: actorId, idempotencyKey } },
      });
      if (existing) return existing;
    }
    try {
      return await prisma.backupRun.create({ data: { trigger, requestedById: actorId, idempotencyKey, activeKey: "platform" } });
    } catch {
      const active = await prisma.backupRun.findFirst({ where: { activeKey: "platform" } });
      if (active) return active;
      throw new Error("BACKUP_REQUEST_FAILED");
    }
  }
  async history() { return prisma.backupRun.findMany({ orderBy: { requestedAt: "desc" }, take: 20 }); }
  async runDue(now = new Date()) {
    const settings = await this.settings();
    if (settings.enabled) {
      const last = await prisma.backupRun.findFirst({ orderBy: { requestedAt: "desc" } });
      if (!last || now.getTime() - last.requestedAt.getTime() >= settings.intervalSeconds * 1000) await this.request("SCHEDULED");
    }
    const run = await prisma.backupRun.findFirst({ where: { status: "QUEUED" }, orderBy: { requestedAt: "asc" } });
    if (!run) return { ready: true, processed: false };
    const owner = randomUUID();
    const claimed = await prisma.backupRun.updateMany({ where: { id: run.id, status: "QUEUED" }, data: { status: "LEASED", leaseOwner: owner, leaseExpiresAt: new Date(now.getTime() + 10 * 60_000), startedAt: now } });
    if (claimed.count !== 1) return { ready: true, processed: false };
    try {
      const content = await createPostgresBackup();
      const stamp = now.toISOString().slice(0, 19).replace("T", "-").replaceAll(":", "-");
      const folderName = `${stamp}-${run.requestedById ?? "system"}`;
      const name = "postgresql.dump.enc";
      const upload = await uploadEncryptedBackup({ name, folderName, content });
      await prisma.backupRun.update({ where: { id: run.id }, data: { status: "SUCCEEDED", activeKey: null, leaseOwner: null, leaseExpiresAt: null, fileName: name, ...upload, completedAt: new Date() } });
      return { ready: true, processed: true };
    } catch (error) {
      await prisma.backupRun.update({ where: { id: run.id }, data: { status: "FAILED", activeKey: null, leaseOwner: null, leaseExpiresAt: null, failureCode: error instanceof Error ? error.message.slice(0, 80) : "BACKUP_FAILED", completedAt: new Date() } });
      return { ready: false, processed: true };
    }
  }
}
