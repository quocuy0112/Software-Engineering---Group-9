import { spawnSync } from "node:child_process";
import process from "node:process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnvironment } from "dotenv";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const deletionModelNames = [
  "UserJobWorkspaceState",
  "SavedJob",
  "ApplicationAnswer",
  "RecruitmentNotificationWork",
  "JobApplication",
  "CandidateCv",
  "CvImportConfirmation",
  "CvDraft",
  "CvRetryRequest",
  "CvProcessingConsent",
  "CvParseJob",
  "OcrUnitOutcome",
  "OcrProcessingAttempt",
  "CvExtraction",
  "CvScanAssessment",
  "CvStoredArtifact",
  "CvUpload",
  "CvAccountQuota",
  "CandidateProfileSkill",
  "ProfileExperience",
  "ProfileEducation",
  "SocialLink",
  "CandidateProfile",
];

// Load local settings without replacing values supplied by the shell.
loadEnvironment({
  path: resolve(repositoryRoot, "web/.env.local"),
  quiet: true,
});
loadEnvironment({
  path: resolve(repositoryRoot, ".env"),
  quiet: true,
});

async function deleteModel(deletions, model, operation) {
  const { count } = await operation();
  deletions.push({ model, count });
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to reset user data while NODE_ENV=production.");
  }

  const requestedUserId = (process.argv[2] ?? process.env.USER_ID ?? "").trim();
  let resolvedUserId = requestedUserId;

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  // The project generates Prisma Client as TypeScript. Re-enter this same
  // script with the existing tsx loader so the requested `node` npm command
  // can still use that generated client without changing old project files.
  if (process.env.SMART_HIRE_DB_RESET_USER_TSX !== "1") {
    const child = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        fileURLToPath(import.meta.url),
        ...process.argv.slice(2),
      ],
      {
        cwd: repositoryRoot,
        env: {
          ...process.env,
          SMART_HIRE_DB_RESET_USER_TSX: "1",
        },
        stdio: "inherit",
      },
    );
    if (child.error) throw child.error;
    process.exitCode = child.status ?? 1;
    return;
  }

  const { PrismaClient } =
    await import("../web/src/backend/generated/prisma/client.ts");
  const prisma = new PrismaClient({
    adapter: new PrismaPg(process.env.DATABASE_URL),
  });

  try {
    const deletions = await prisma.$transaction(
      async (transaction) => {
        const accounts = await transaction.userAccount.findMany({
          ...(requestedUserId ? { where: { id: requestedUserId } } : {}),
          select: { id: true },
        });
        if (requestedUserId && accounts.length === 0) {
          throw new Error(`UserAccount not found for id: ${requestedUserId}`);
        }
        if (!requestedUserId && accounts.length > 1) {
          throw new Error(
            "Multiple user accounts found. Set USER_ID or pass a user id explicitly.",
          );
        }
        const userId = accounts[0]?.id;
        resolvedUserId = userId;
        if (!userId) {
          return deletionModelNames.map((model) => ({ model, count: 0 }));
        }

        const profileIds = (
          await transaction.candidateProfile.findMany({
            where: { candidateUserId: userId },
            select: { id: true },
          })
        ).map(({ id }) => id);

        const applicationIds = (
          await transaction.jobApplication.findMany({
            where: { candidateUserId: userId },
            select: { id: true },
          })
        ).map(({ id }) => id);

        const cvExtractionIds = (
          await transaction.cvExtraction.findMany({
            where: { accountId: userId },
            select: { id: true },
          })
        ).map(({ id }) => id);

        const cvOcrAttemptIds = (
          await transaction.ocrProcessingAttempt.findMany({
            where: { cvExtractionId: { in: cvExtractionIds } },
            select: { id: true },
          })
        ).map(({ id }) => id);

        const results = [];

        await deleteModel(results, "UserJobWorkspaceState", () =>
          transaction.userJobWorkspaceState.deleteMany({
            where: { userId },
          }),
        );

        // Saved jobs and applied jobs are deleted before their user-owned
        // candidate/CV records. Application children must go first.
        await deleteModel(results, "SavedJob", () =>
          transaction.savedJob.deleteMany({ where: { userId } }),
        );
        await deleteModel(results, "ApplicationAnswer", () =>
          transaction.applicationAnswer.deleteMany({
            where: { applicationId: { in: applicationIds } },
          }),
        );
        await deleteModel(results, "RecruitmentNotificationWork", () =>
          transaction.recruitmentNotificationWork.deleteMany({
            where: { applicationId: { in: applicationIds } },
          }),
        );
        await deleteModel(results, "JobApplication", () =>
          transaction.jobApplication.deleteMany({
            where: { id: { in: applicationIds } },
          }),
        );
        await deleteModel(results, "CandidateCv", () =>
          transaction.candidateCv.deleteMany({
            where: { candidateUserId: userId },
          }),
        );

        // CV workflow children must be deleted before uploads and artifacts.
        await deleteModel(results, "CvImportConfirmation", () =>
          transaction.cvImportConfirmation.deleteMany({
            where: { accountId: userId },
          }),
        );
        await deleteModel(results, "CvDraft", () =>
          transaction.cvDraft.deleteMany({ where: { accountId: userId } }),
        );
        await deleteModel(results, "CvRetryRequest", () =>
          transaction.cvRetryRequest.deleteMany({
            where: { accountId: userId },
          }),
        );
        await deleteModel(results, "CvProcessingConsent", () =>
          transaction.cvProcessingConsent.deleteMany({
            where: { accountId: userId },
          }),
        );
        await deleteModel(results, "CvParseJob", () =>
          transaction.cvParseJob.deleteMany({ where: { accountId: userId } }),
        );
        await deleteModel(results, "OcrUnitOutcome", () =>
          transaction.ocrUnitOutcome.deleteMany({
            where: { attemptId: { in: cvOcrAttemptIds } },
          }),
        );
        await deleteModel(results, "OcrProcessingAttempt", () =>
          transaction.ocrProcessingAttempt.deleteMany({
            where: { id: { in: cvOcrAttemptIds } },
          }),
        );
        await deleteModel(results, "CvExtraction", () =>
          transaction.cvExtraction.deleteMany({ where: { accountId: userId } }),
        );
        await deleteModel(results, "CvScanAssessment", () =>
          transaction.cvScanAssessment.deleteMany({
            where: { accountId: userId },
          }),
        );
        await deleteModel(results, "CvStoredArtifact", () =>
          transaction.cvStoredArtifact.deleteMany({
            where: { accountId: userId },
          }),
        );
        await deleteModel(results, "CvUpload", () =>
          transaction.cvUpload.deleteMany({ where: { accountId: userId } }),
        );
        await deleteModel(results, "CvAccountQuota", () =>
          transaction.cvAccountQuota.deleteMany({
            where: { accountId: userId },
          }),
        );

        // Profile children and user-owned skill links must go before profile.
        await deleteModel(results, "CandidateProfileSkill", () =>
          transaction.candidateProfileSkill.deleteMany({
            where: { profileId: { in: profileIds } },
          }),
        );
        await deleteModel(results, "ProfileExperience", () =>
          transaction.profileExperience.deleteMany({
            where: { profileId: { in: profileIds } },
          }),
        );
        await deleteModel(results, "ProfileEducation", () =>
          transaction.profileEducation.deleteMany({
            where: { profileId: { in: profileIds } },
          }),
        );
        await deleteModel(results, "SocialLink", () =>
          transaction.socialLink.deleteMany({
            where: { profileId: { in: profileIds } },
          }),
        );
        await deleteModel(results, "CandidateProfile", () =>
          transaction.candidateProfile.deleteMany({
            where: { id: { in: profileIds } },
          }),
        );

        return results;
      },
      { maxWait: 30_000, timeout: 60_000 },
    );

    const scopeLabel = requestedUserId
      ? `user ${requestedUserId}`
      : resolvedUserId
        ? `auto-selected user ${resolvedUserId}`
        : "no user found; nothing to reset";
    console.log(`[db:reset:user] Scope: ${scopeLabel}.`);
    for (const { model, count } of deletions) {
      console.log(`[db:reset:user] ${model}: ${count} record(s) deleted.`);
    }
    console.log(
      "[db:reset:user] SuggestedJob: no persisted model in schema; 0 record(s) affected (computed dynamically).",
    );
    console.log(
      "[db:reset:user] Skill: shared catalog retained; user skill links were deleted via CandidateProfileSkill.",
    );
    console.log(
      `[db:reset:user] Completed for ${scopeLabel}. UserAccount and auth data were not modified.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
