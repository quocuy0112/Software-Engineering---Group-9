import "server-only";
import {
  PrismaSystemReadinessRepository,
  type SystemReadinessRepository,
} from "@/backend/repositories/system/prisma-system-readiness-repository";

export type SystemReadiness =
  | { ready: true; status: "ok" }
  | { ready: false; status: "unavailable" };

export class SystemReadinessService {
  constructor(
    private readonly repository: SystemReadinessRepository = new PrismaSystemReadinessRepository(),
  ) {}

  async check(): Promise<SystemReadiness> {
    try {
      return (await this.repository.schemaReady())
        ? { ready: true, status: "ok" }
        : { ready: false, status: "unavailable" };
    } catch {
      return { ready: false, status: "unavailable" };
    }
  }
}
