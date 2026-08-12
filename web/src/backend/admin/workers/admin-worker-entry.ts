import "server-only";
import { AdminWorkerRuntime } from "./admin-worker-runtime";
import { runDashboardSnapshotCycle } from "./dashboard-snapshot-loop";
import {
  runEvidenceSafetyCycle,
  runVerificationDeadlineCycle,
} from "./verification-lifecycle-loop";
import { runEvidenceRetentionCycle } from "./evidence-retention-loop";
import { runSecurityNotificationCycle } from "./security-notification-loop";
import { runRationaleRetentionCycle } from "./rationale-retention-loop";
import { runSupportLifecycleCycle } from "./support-lifecycle-loop";

export async function startAdminWorker(options: { probe?: boolean } = {}) {
  const runtime = new AdminWorkerRuntime([
    { name: "snapshot", intervalMs: 30_000, run: runDashboardSnapshotCycle },
    { name: "evidence", intervalMs: 5_000, run: runEvidenceSafetyCycle },
    {
      name: "verification-deadline",
      intervalMs: 60_000,
      run: runVerificationDeadlineCycle,
    },
    {
      name: "notification",
      intervalMs: 30_000,
      run: runSecurityNotificationCycle,
    },
    {
      name: "retention",
      intervalMs: 60_000,
      run: async (now) => ({
        evidence: await runEvidenceRetentionCycle(now),
        rationales: await runRationaleRetentionCycle(now),
      }),
    },
    { name: "support", intervalMs: 60_000, run: runSupportLifecycleCycle },
  ]);
  const readiness = await runtime.probe();
  if (readiness.some((item) => !item.ready))
    throw new Error("ADMIN_WORKER_NOT_READY");
  if (!options.probe) runtime.start();
  return { readiness, stop: async () => runtime.stop() };
}
