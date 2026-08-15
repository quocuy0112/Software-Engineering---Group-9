import "server-only";
import { resolve } from "node:path";
import {
  JsonJobCatalogueRepository,
  type JobCatalogueLeaseCoordinator,
} from "./json-job-catalogue-repository";
import { PrismaJobCatalogueWriteLeaseRepository } from "./prisma-job-catalogue-write-lease-repository";

const testLeaseCoordinator: JobCatalogueLeaseCoordinator = {
  async claim(input) {
    return { ...input, version: 1 };
  },
  async renew(claim, leaseExpiresAt) {
    return { ...claim, leaseExpiresAt };
  },
  async assertOwned() {},
  async release() {},
};

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
  const isTest = process.env.NODE_ENV === "test";
  return new JsonJobCatalogueRepository<T>({
    filePath,
    mode:
      isTest || process.env.JOB_CATALOGUE_MODE === "writer"
        ? "writer"
        : "readonly",
    writerHostId:
      process.env.JOB_CATALOGUE_WRITER_HOST_ID?.trim() ||
      (isTest ? "vitest-isolated-writer" : null),
    leaseCoordinator: isTest
      ? testLeaseCoordinator
      : new PrismaJobCatalogueWriteLeaseRepository(),
    leaseTtlMs,
  });
}
