import "server-only";
import { dashboardSnapshotSchema } from "@/shared/contracts/admin/resources";
import { PrismaAdminDashboardRepository } from "@/backend/repositories/admin/prisma-admin-dashboard-repository";

export class DashboardSnapshotUnavailableError extends Error {
  constructor() {
    super("DASHBOARD_SNAPSHOT_UNAVAILABLE");
  }
}

export class DashboardSnapshotService {
  constructor(
    private readonly repository = new PrismaAdminDashboardRepository(),
  ) {}

  async calculate(now = new Date()) {
    const metrics = await this.repository.calculate(now);
    return this.repository.create(metrics, now);
  }

  async current(now = new Date()) {
    const snapshot = await this.repository.current(now);
    if (!snapshot) throw new DashboardSnapshotUnavailableError();
    return dashboardSnapshotSchema.parse({
      id: snapshot.id,
      metrics: snapshot.metrics,
      stateDefinitionVersion: snapshot.stateDefinitionVersion,
      calculatedAt: snapshot.calculatedAt.toISOString(),
      expiresAt: snapshot.expiresAt.toISOString(),
    });
  }

  async ensureCurrent(now = new Date()) {
    try {
      return await this.current(now);
    } catch {
      await this.calculate(now);
      return this.current(now);
    }
  }
}
