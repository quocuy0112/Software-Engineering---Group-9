import "server-only";

import { readFile } from "node:fs/promises";

import { prisma } from "@/backend/database/prisma";

export class ImageSearchAdmissionReadinessError extends Error {
  constructor(
    public readonly component:
      | "CLEANUP"
      | "RECONCILIATION"
      | "STORAGE_PREFLIGHT",
  ) {
    super(`IMAGE_SEARCH_${component}_NOT_READY`);
    this.name = "ImageSearchAdmissionReadinessError";
  }
}

export async function recordImageSearchOperationalEvidence(input: {
  component: "CLEANUP" | "RECONCILIATION" | "STORAGE_PREFLIGHT";
  evidenceVersion: string;
  evidenceDigest?: Uint8Array;
  succeededAt: Date;
  validForMs: number;
}) {
  await prisma.imageSearchOperationalEvidence.upsert({
    where: { component: input.component },
    create: {
      component: input.component,
      evidenceVersion: input.evidenceVersion,
      evidenceDigest: input.evidenceDigest
        ? Buffer.from(input.evidenceDigest)
        : null,
      succeededAt: input.succeededAt,
      validUntil: new Date(input.succeededAt.getTime() + input.validForMs),
    },
    update: {
      evidenceVersion: input.evidenceVersion,
      evidenceDigest: input.evidenceDigest
        ? Buffer.from(input.evidenceDigest)
        : null,
      succeededAt: input.succeededAt,
      validUntil: new Date(input.succeededAt.getTime() + input.validForMs),
    },
    select: { component: true },
  });
}

export class ImageSearchAdmissionReadiness {
  constructor(
    private readonly options: Readonly<{
      production: boolean;
      preflightReportPath?: string;
    }>,
  ) {}

  async assertAdmissionReady(now: Date) {
    const components: Array<
      "CLEANUP" | "RECONCILIATION" | "STORAGE_PREFLIGHT"
    > = [
      "CLEANUP",
      "RECONCILIATION",
      ...(this.options.production ? (["STORAGE_PREFLIGHT"] as const) : []),
    ];
    const evidence = await prisma.imageSearchOperationalEvidence.findMany({
      where: { component: { in: components } },
      select: {
        component: true,
        evidenceVersion: true,
        validUntil: true,
      },
    });
    for (const component of components) {
      const current = evidence.find((item) => item.component === component);
      if (!current || current.validUntil <= now)
        throw new ImageSearchAdmissionReadinessError(component);
      if (component === "STORAGE_PREFLIGHT") {
        const digestRows = await prisma.$queryRaw<
          Array<{ digestHex: string | null }>
        >`
          SELECT encode("evidenceDigest", 'hex') AS "digestHex"
            FROM "ImageSearchOperationalEvidence"
           WHERE "component" = 'STORAGE_PREFLIGHT'
           LIMIT 1`;
        const evidenceDigest = digestRows[0]?.digestHex
          ? Buffer.from(digestRows[0].digestHex, "hex")
          : null;
        if (!this.options.preflightReportPath || !evidenceDigest)
          throw new ImageSearchAdmissionReadinessError(component);
        const bytes = await readFile(this.options.preflightReportPath).catch(
          () => null,
        );
        if (!bytes) throw new ImageSearchAdmissionReadinessError(component);
        const { createHash } = await import("node:crypto");
        const digest = createHash("sha256").update(bytes).digest();
        if (!digest.equals(evidenceDigest))
          throw new ImageSearchAdmissionReadinessError(component);
      }
    }
  }
}
