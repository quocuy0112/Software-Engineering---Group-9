import { config } from "dotenv";

config({ path: new URL("../.env.local", import.meta.url), quiet: true });

const { configuredJsonJobCatalogueRepository } =
  await import("../src/backend/repositories/jobs/job-catalogue-repository-factory.ts");
const { prisma } = await import("../src/backend/database/prisma.ts");

try {
  const readiness =
    await configuredJsonJobCatalogueRepository(
      "jobs.json",
    ).verifyWriterReadiness();
  console.log(
    JSON.stringify(
      {
        pass: true,
        mode: process.env.JOB_CATALOGUE_MODE,
        writerHostIdConfigured: Boolean(
          process.env.JOB_CATALOGUE_WRITER_HOST_ID?.trim(),
        ),
        ...readiness,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    JSON.stringify(
      {
        pass: false,
        code: error instanceof Error ? error.message : "UNKNOWN_ERROR",
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
