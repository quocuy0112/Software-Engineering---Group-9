import "server-only";

import { cvConfiguration, cvParserAvailability } from "@/backend/cv/config";
import { prisma } from "@/backend/database/prisma";

export async function getSystemHealth() {
  const parserAvailability = cvParserAvailability(cvConfiguration);
  const now = new Date();
  const evidence = await prisma.imageSearchOperationalEvidence
    .findMany({
      where: { component: { in: ["CLEANUP", "RECONCILIATION"] } },
      select: { component: true, validUntil: true },
    })
    .catch(() => []);
  const ready = (component: string) =>
    Boolean(
      evidence.find(
        (item) => item.component === component && item.validUntil > now,
      ),
    );

  return {
    status: "ok" as const,
    cv: {
      cleanupEnabled: cvConfiguration.cleanupEnabled,
      processingEnabled: cvConfiguration.workerEnabled,
      deterministicParserReady: parserAvailability.deterministic,
      externalParserReady: parserAvailability.external,
    },
    capabilities: {
      nativeCvImport: true,
      ordinaryJobSearch: true,
      cvHybridOcrConfigured: process.env.OCR_ENGINE_ENABLED === "true",
      imageSearchWorkerConfigured:
        process.env.IMAGE_SEARCH_WORKER_ENABLED === "true",
      imageSearchAdmissionReady: ready("CLEANUP") && ready("RECONCILIATION"),
      cleanupReady: ready("CLEANUP"),
      reconciliationReady: ready("RECONCILIATION"),
    },
  };
}
