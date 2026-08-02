import "server-only";

import { prisma, verifyDatabaseConnectivity } from "@/backend/database/prisma";
import { cvConfiguration } from "@/backend/cv/config";
import { CvWorkerRuntime } from "./cv-worker-runtime";
import {
  createCvWorkerReadiness,
  createDefaultCvWorkerPipeline,
  createCvWorkerMaintenance,
  materializePendingDeterministicParseJob,
  type CvWorkerPipeline,
} from "./pipeline";

// Story processors are registered as their stages are implemented. Cleanup is
// intentionally mandatory so disabling new CV processing never disables purge.
export async function runCvWorker(pipeline?: CvWorkerPipeline): Promise<void> {
  if (!cvConfiguration.cleanupEnabled) {
    throw new Error("CV_CLEANUP_MUST_REMAIN_ENABLED");
  }
  const maintenance = createCvWorkerMaintenance();
  const runtime = new CvWorkerRuntime({
    pipeline: pipeline ?? createDefaultCvWorkerPipeline(),
    readiness: async () => {
      await verifyDatabaseConnectivity();
      await createCvWorkerReadiness();
    },
    beforePoll: async () => {
      await maintenance();
      if (cvConfiguration.workerEnabled)
        await materializePendingDeterministicParseJob();
    },
  });
  const stop = () => void runtime.shutdown();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    await runtime.run();
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    await prisma.$disconnect();
  }
}
