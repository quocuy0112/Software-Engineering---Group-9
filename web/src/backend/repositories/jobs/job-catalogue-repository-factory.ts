import "server-only";
import { resolve } from "node:path";
import { JsonJobCatalogueRepository } from "./json-job-catalogue-repository";
import { PrismaJobCatalogueWriteLeaseRepository } from "./prisma-job-catalogue-write-lease-repository";

export function configuredJsonJobCatalogueRepository<T = unknown>(
  name: "jobs.json" | "companies.json" | "applications.json",
) {
  const configuredJobsPath = process.env.JOB_CATALOGUE_PATH?.trim();
  const filePath =
    name === "jobs.json" && configuredJobsPath
      ? resolve(process.cwd(), configuredJobsPath)
      : resolve(process.cwd(), "data", "jobs", name);
  const leaseTtlMs = Number.parseInt(
    process.env.JOB_CATALOGUE_LEASE_TTL_MS ?? "30000",
    10,
  );
  return new JsonJobCatalogueRepository<T>({
    filePath,
    mode: process.env.JOB_CATALOGUE_MODE === "writer" ? "writer" : "readonly",
    writerHostId: process.env.JOB_CATALOGUE_WRITER_HOST_ID?.trim() || null,
    leaseCoordinator: new PrismaJobCatalogueWriteLeaseRepository(),
    leaseTtlMs,
  });
}
