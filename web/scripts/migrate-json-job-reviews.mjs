import { config } from "dotenv";

config({ path: new URL("../.env.local", import.meta.url), quiet: true });
const apply = process.argv.includes("--apply");
const { configuredJsonJobCatalogueRepository } =
  await import("../src/backend/repositories/jobs/job-catalogue-repository-factory.ts");
const { prisma } = await import("../src/backend/database/prisma.ts");

try {
  const jobs = await configuredJsonJobCatalogueRepository("jobs.json").read();
  const candidates = jobs.filter(
    (job) =>
      job &&
      typeof job === "object" &&
      ["pending_approval", "rejected"].includes(job.status),
  );
  const existing = await prisma.jobPostReviewAggregate.findMany({
    where: { jobId: { in: candidates.map((job) => job.id) } },
    select: { jobId: true },
  });
  const adopted = new Set(existing.map((row) => row.jobId));
  const unresolved = candidates
    .filter((job) => !adopted.has(job.id))
    .map((job) => ({
      jobId: job.id,
      status: job.status,
      code: "HISTORICAL_SUBMISSION_AUTHORITY_UNPROVEN",
    }));

  // Pending/rejected legacy rows cannot be silently attributed to a User or
  // membership. They remain unresolved until an operator supplies auditable
  // authority; reruns are safe because adopted job IDs are excluded above.
  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        candidateCount: candidates.length,
        alreadyAdoptedCount: candidates.length - unresolved.length,
        adoptedCount: 0,
        unresolved,
      },
      null,
      2,
    ),
  );
  if (apply && unresolved.length > 0) process.exitCode = 2;
} finally {
  await prisma.$disconnect();
}
