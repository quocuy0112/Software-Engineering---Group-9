import "server-only";
import { DashboardSnapshotService } from "@/backend/admin/dashboard/dashboard-snapshot-service";
import { PrismaAdminDashboardRepository } from "@/backend/repositories/admin/prisma-admin-dashboard-repository";

export async function runDashboardSnapshotCycle(now = new Date()) {
  const service = new DashboardSnapshotService();
  const snapshot = await service.calculate(now);
  await new PrismaAdminDashboardRepository().cleanup(
    new Date(now.getTime() - 24 * 60 * 60_000),
  );
  return {
    ready: true,
    snapshotId: snapshot.id,
    calculatedAt: snapshot.calculatedAt,
  };
}
