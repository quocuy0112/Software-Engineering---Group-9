import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir, rename, writeFile } from "node:fs/promises";
import process from "node:process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnvironment } from "dotenv";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function resetEmailFor(userId) {
  const suffix = createHash("sha256").update(userId, "utf8").digest("hex");
  return `reset-${suffix.slice(0, 24)}@local.invalid`;
}

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

async function updateModel(deletions, model, operation, action = "updated") {
  const { count } = await operation();
  deletions.push({ model, count, action });
}

async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function writeJsonAtomically(filePath, value) {
  const temporaryPath = `${filePath}.${process.pid}.reset.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, filePath);
}

async function readLocalJobFiles() {
  const jobsDirectory = resolve(repositoryRoot, "web/data/jobs");
  const jobsPath = resolve(jobsDirectory, "jobs.json");
  const sourceJobs = await readJsonIfPresent(jobsPath);
  if (Array.isArray(sourceJobs)) {
    return { jobsDirectory, files: [{ filePath: jobsPath, jobs: sourceJobs }] };
  }

  const entries = await readdir(jobsDirectory, { withFileTypes: true });
  const splitPaths = entries
    .filter(
      (entry) => entry.isFile() && /^jobs_.+_r\d{2}\.json$/u.test(entry.name),
    )
    .map((entry) => resolve(jobsDirectory, entry.name))
    .sort();
  const files = [];
  for (const filePath of splitPaths) {
    const jobs = await readJsonIfPresent(filePath);
    if (!Array.isArray(jobs))
      throw new Error(`Invalid split jobs file: ${filePath}`);
    files.push({ filePath, jobs });
  }
  return { jobsDirectory, files };
}

async function readLocalUserOwnership(userIds) {
  const userIdSet = new Set(userIds);
  const companiesPath = resolve(
    repositoryRoot,
    "web/data/companies/companies.json",
  );
  const companies = await readJsonIfPresent(companiesPath);
  const companyRows = Array.isArray(companies) ? companies : [];
  const companyOwnerById = new Map(
    companyRows
      .filter((company) => typeof company?.id === "string")
      .map((company) => [company.id, company.ownerUserId ?? null]),
  );
  // Shared/imported companies have no ownerUserId. A company with an owner
  // marker is user-created, regardless of whether its id is a CUID or UUID.
  const companyIds = companyRows
    .filter((company) => userIdSet.has(company?.ownerUserId))
    .map((company) => company.id)
    .filter((id) => typeof id === "string");
  const companyIdSet = new Set(companyIds);
  const { files } = await readLocalJobFiles();
  const jobIds = files
    .flatMap(({ jobs }) => jobs)
    .filter((job) =>
      isLocalJobOwnedByResetUser(
        job,
        userIdSet,
        companyIdSet,
        companyOwnerById,
      ),
    )
    .map((job) => job?.id)
    .filter((id) => typeof id === "string");
  return { companyIds, jobIds };
}

function isLocalJobOwnedByResetUser(
  job,
  userIdSet,
  ownedCompanyIds,
  companyOwnerById,
) {
  if (ownedCompanyIds.has(job?.companyId)) return true;
  if (!userIdSet.has(job?.createdByUserId)) return false;

  // A non-owner may create a draft under another user's company. The job is
  // still part of the owner's company catalogue and must survive that
  // member's reset. Jobs in an unowned/shared catalogue (or without a
  // company record) remain removable when created by the reset user.
  const companyOwnerId = companyOwnerById.get(job?.companyId);
  return !companyOwnerId || userIdSet.has(companyOwnerId);
}

/**
 * The recruiter workspace keeps companies and draft/job-posting records in
 * the local JSON catalogue. Keep that catalogue in sync with the database
 * reset: remove companies owned by the reset account, remove user-owned jobs
 * that are not part of another owner's company, and scrub local applications.
 */
async function purgeLocalUserCatalogue(userIds) {
  if (userIds.length === 0) {
    return { companies: 0, jobs: 0, applications: 0 };
  }

  const userIdSet = new Set(userIds);
  const companiesPath = resolve(
    repositoryRoot,
    "web/data/companies/companies.json",
  );
  const companies = await readJsonIfPresent(companiesPath);
  const companyRows = Array.isArray(companies) ? companies : [];
  const companyOwnerById = new Map(
    companyRows
      .filter((company) => typeof company?.id === "string")
      .map((company) => [company.id, company.ownerUserId ?? null]),
  );
  const ownedCompanyIds = new Set(
    companyRows
      .filter((company) => userIdSet.has(company?.ownerUserId))
      .map((company) => company.id)
      .filter((id) => typeof id === "string"),
  );
  const nextCompanies = companyRows
    .filter((company) => !ownedCompanyIds.has(company?.id))
    .map((company) => ({
      ...company,
      memberUserIds: Array.isArray(company?.memberUserIds)
        ? company.memberUserIds.filter((id) => !userIdSet.has(id))
        : company?.memberUserIds,
    }));
  if (
    companies &&
    JSON.stringify(nextCompanies) !== JSON.stringify(companyRows)
  ) {
    await writeJsonAtomically(companiesPath, nextCompanies);
  }

  const { files: jobFiles } = await readLocalJobFiles();
  const ownedJobIds = new Set();
  let removedJobs = 0;
  for (const { filePath, jobs } of jobFiles) {
    const nextJobs = jobs.filter((job) => {
      const owned = isLocalJobOwnedByResetUser(
        job,
        userIdSet,
        ownedCompanyIds,
        companyOwnerById,
      );
      if (owned) {
        if (typeof job?.id === "string") ownedJobIds.add(job.id);
        removedJobs += 1;
      }
      return !owned;
    });
    if (nextJobs.length !== jobs.length)
      await writeJsonAtomically(filePath, nextJobs);
  }

  const applicationsPath = resolve(
    repositoryRoot,
    "web/data/user/applications.json",
  );
  const applications = await readJsonIfPresent(applicationsPath);
  let removedApplications = 0;
  if (Array.isArray(applications)) {
    const nextApplications = applications.filter((application) => {
      const owned =
        userIdSet.has(application?.userId) ||
        ownedJobIds.has(application?.jobId);
      if (owned) removedApplications += 1;
      return !owned;
    });
    if (nextApplications.length !== applications.length)
      await writeJsonAtomically(applicationsPath, nextApplications);
  }

  return {
    companies: ownedCompanyIds.size,
    jobs: removedJobs,
    applications: removedApplications,
  };
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to reset user data while NODE_ENV=production.");
  }

  const requestedUserRef = (
    process.argv[2] ??
    process.env.USER_ID ??
    ""
  ).trim();
  const requestedEmail = requestedUserRef.includes("@")
    ? requestedUserRef.toLowerCase()
    : "";
  const requestedUserId = requestedEmail ? "" : requestedUserRef;
  const resetAllAccounts = !requestedUserRef;
  let resolvedUserIds = [];
  let resolvedLocalOwnership = { companyIds: [], jobIds: [] };

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
        "--conditions=react-server",
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
  const { distributeUnassignedPendingReviews } =
    await import("../web/src/backend/jobs/review/job-post-review-assignment.ts");
  const prisma = new PrismaClient({
    adapter: new PrismaPg(process.env.DATABASE_URL),
  });

  try {
    const deletions = await prisma.$transaction(
      async (transaction) => {
        // CV audit/history tables have database guards because normal
        // application code must be append-only. This development-only reset
        // explicitly enters the retention cleanup mode for its transaction.
        await transaction.$executeRawUnsafe(
          "SELECT set_config('smarthire.cv_retention_mode', 'on', true)",
        );
        const accounts = await transaction.userAccount.findMany({
          ...(requestedUserRef
            ? {
                where: requestedEmail
                  ? { normalizedEmail: requestedEmail }
                  : { id: requestedUserId },
              }
            : {}),
          select: { id: true },
        });
        if (requestedUserRef && accounts.length === 0) {
          throw new Error(
            `UserAccount not found for id or email: ${requestedUserRef}`,
          );
        }
        // With no explicit USER_ID, reset every local account so the normal
        // db:reset command behaves consistently even after multiple sign-ups.
        const userIds = accounts.map(({ id }) => id);
        resolvedUserIds = userIds;
        const userIdFilter = { in: userIds };
        resolvedLocalOwnership = await readLocalUserOwnership(userIds);

        const profileIds = (
          await transaction.candidateProfile.findMany({
            where: { candidateUserId: userIdFilter },
            select: { id: true },
          })
        ).map(({ id }) => id);

        const applicationIds = (
          await transaction.jobApplication.findMany({
            where: { candidateUserId: userIdFilter },
            select: { id: true },
          })
        ).map(({ id }) => id);

        const cvExtractionIds = (
          await transaction.cvExtraction.findMany({
            where: { accountId: userIdFilter },
            select: { id: true },
          })
        ).map(({ id }) => id);

        const cvOcrAttemptIds = (
          await transaction.ocrProcessingAttempt.findMany({
            where: { cvExtractionId: { in: cvExtractionIds } },
            select: { id: true },
          })
        ).map(({ id }) => id);

        const reviewAggregates =
          await transaction.jobPostReviewAggregate.findMany({
            select: { id: true, companyId: true, publicJobPostingId: true },
          });
        const reviewVersions = await transaction.jobPostReviewVersion.findMany({
          select: {
            id: true,
            reviewAggregateId: true,
            sequence: true,
            state: true,
            importedBaseline: true,
            submittedByUserId: true,
            submittedMembershipId: true,
            assignedAdminUserId: true,
          },
        });
        const resetUserIdSet = new Set(userIds);
        const baselineByAggregate = new Map();
        for (const version of reviewVersions) {
          if (!version.importedBaseline) continue;
          const previous = baselineByAggregate.get(version.reviewAggregateId);
          if (!previous || version.sequence < previous.sequence) {
            baselineByAggregate.set(version.reviewAggregateId, version);
          }
        }
        const transientReviewVersionIds = reviewVersions
          .filter(
            (version) =>
              !version.importedBaseline &&
              (resetAllAccounts ||
                resetUserIdSet.has(version.submittedByUserId)),
          )
          .map((version) => version.id);
        const protectedMembershipIds = [
          ...new Set(
            reviewVersions
              .filter(
                (version) =>
                  version.importedBaseline && version.submittedMembershipId,
              )
              .map((version) => version.submittedMembershipId),
          ),
        ];

        // A membership alone does not prove that the user owns the company:
        // users can be invited to a shared company. OWNER memberships that
        // are not part of the imported catalog baseline identify companies
        // created by the user and therefore safe to remove with the account.
        // HR/recruiter memberships in another owner's company do not add that
        // company (or its database jobs) to the reset scope.
        const ownerMemberships = await transaction.companyMembership.findMany({
          where: {
            userId: userIdFilter,
            role: "OWNER",
            status: { not: "REMOVED" },
          },
          select: { id: true, companyId: true },
        });
        const protectedMembershipIdSet = new Set(protectedMembershipIds);
        const ownedCompanyIds = [
          ...new Set([
            ...ownerMemberships
              .filter(({ id }) => !protectedMembershipIdSet.has(id))
              .map(({ companyId }) => companyId),
            ...resolvedLocalOwnership.companyIds,
          ]),
        ];
        const ownedCompanyIdSet = new Set(ownedCompanyIds);
        const ownedReviewAggregateIds = reviewAggregates
          .filter((aggregate) => ownedCompanyIdSet.has(aggregate.companyId))
          .map(({ id }) => id);
        const ownedReviewVersionIds = reviewVersions
          .filter((version) =>
            ownedReviewAggregateIds.includes(version.reviewAggregateId),
          )
          .map(({ id }) => id);
        const transientReviewVersionIdSet = new Set(transientReviewVersionIds);
        const reviewAggregateIdsToRestore = [
          ...new Set(
            reviewVersions
              .filter(
                (version) =>
                  transientReviewVersionIdSet.has(version.id) &&
                  !ownedReviewAggregateIds.includes(version.reviewAggregateId),
              )
              .map(({ reviewAggregateId }) => reviewAggregateId),
          ),
        ];
        const reviewAggregatePointerResetIds = [
          ...new Set([
            ...ownedReviewAggregateIds,
            ...reviewAggregateIdsToRestore,
          ]),
        ];
        const ownedJobPostingIds = [
          ...new Set([
            ...resolvedLocalOwnership.jobIds,
            ...(
              await transaction.jobPosting.findMany({
                where: { companyId: { in: ownedCompanyIds } },
                select: { id: true },
              })
            ).map(({ id }) => id),
          ]),
        ];

        const results = [];
        const now = new Date();

        // A targeted reset can remove an administrator account without
        // removing the recruiter who submitted a review. Release only that
        // administrator's pending assignments; the immutable review version
        // and aggregate pending pointer must survive for another admin.
        await updateModel(
          results,
          "PendingJobPostReviewAssignment",
          () =>
            transaction.jobPostReviewVersion.updateMany({
              where: {
                state: "PENDING_REVIEW",
                assignedAdminUserId: userIdFilter,
              },
              data: { assignedAdminUserId: null, assignedAt: null },
            }),
          "released",
        );

        // Reset admin-only operational state while retaining the company/job
        // catalog. These rows are safe to recreate during local development.
        await deleteModel(results, "SecurityNotificationWork", () =>
          transaction.securityNotificationWork.deleteMany({
            where: { targetUserId: userIdFilter },
          }),
        );
        await deleteModel(results, "InAppNotification", () =>
          transaction.inAppNotification.deleteMany({
            where: { recipientUserId: userIdFilter },
          }),
        );
        await deleteModel(results, "AdminDashboardSnapshot", () =>
          transaction.adminDashboardSnapshot.deleteMany(),
        );
        await deleteModel(results, "AdminCommandReceipt", () =>
          transaction.adminCommandReceipt.deleteMany(),
        );
        await deleteModel(results, "PrivilegedActionRationale", () =>
          transaction.privilegedActionRationale.deleteMany(),
        );
        await deleteModel(results, "PlatformAdministratorGrant", () =>
          transaction.platformAdministratorGrant.deleteMany({
            // Resetting one account must not revoke administrator grants for
            // other accounts. Grant scopes and the administrator session
            // policy cascade only for the selected user.
            where: { userId: userIdFilter },
          }),
        );
        await deleteModel(results, "CompanyInvitation", () =>
          transaction.companyInvitation.deleteMany(),
        );
        await deleteModel(results, "CompanyAccessPrerequisite", () =>
          transaction.companyAccessPrerequisite.deleteMany(),
        );
        await deleteModel(results, "CompanyTeamActivity", () =>
          transaction.companyTeamActivity.deleteMany(),
        );
        // A full reset removes post-baseline workflow rows. A targeted reset
        // removes only versions submitted by that account (plus aggregates
        // owned by its company below), so deleting an administrator cannot
        // erase another recruiter's pending submission.
        await deleteModel(results, "JobPostRevisionRequest", () =>
          transaction.jobPostRevisionRequest.deleteMany(),
        );
        await deleteModel(results, "JobPostFeaturedPlacement", () =>
          transaction.jobPostFeaturedPlacement.deleteMany(),
        );
        await deleteModel(results, "JobPostOperationalHistory", () =>
          transaction.jobPostOperationalHistory.deleteMany(),
        );
        await deleteModel(results, "JobPostEnforcementTarget", () =>
          transaction.jobPostEnforcementTarget.deleteMany(),
        );
        await deleteModel(results, "ModerationReportEnforcementLink", () =>
          transaction.moderationReportEnforcementLink.deleteMany(),
        );
        await deleteModel(results, "ModerationPrivateNote", () =>
          transaction.moderationPrivateNote.deleteMany(),
        );
        await deleteModel(results, "ModerationReportHistory", () =>
          transaction.moderationReportHistory.deleteMany(),
        );
        await deleteModel(results, "ModerationReport", () =>
          transaction.moderationReport.deleteMany(),
        );
        await deleteModel(results, "JobPostEnforcementAction", () =>
          transaction.jobPostEnforcementAction.deleteMany(),
        );
        await deleteModel(results, "JobPostReviewPrivateNote", () =>
          transaction.jobPostReviewPrivateNote.deleteMany({
            where: { reviewVersionId: { in: transientReviewVersionIds } },
          }),
        );
        await deleteModel(results, "JobPostReviewHistory", () =>
          transaction.jobPostReviewHistory.deleteMany({
            where: { reviewVersionId: { in: transientReviewVersionIds } },
          }),
        );
        await deleteModel(results, "OwnedJobPostReviewPrivateNote", () =>
          transaction.jobPostReviewPrivateNote.deleteMany({
            where: { reviewVersionId: { in: ownedReviewVersionIds } },
          }),
        );
        await deleteModel(results, "OwnedJobPostReviewHistory", () =>
          transaction.jobPostReviewHistory.deleteMany({
            where: { reviewVersionId: { in: ownedReviewVersionIds } },
          }),
        );
        await updateModel(
          results,
          "JobPostReviewAggregatePointers",
          () =>
            transaction.jobPostReviewAggregate.updateMany({
              where: { id: { in: reviewAggregatePointerResetIds } },
              data: { pendingVersionId: null, approvedVersionId: null },
            }),
          "cleared",
        );
        await deleteModel(results, "JobPostReviewVersion", () =>
          transaction.jobPostReviewVersion.deleteMany({
            where: { id: { in: transientReviewVersionIds } },
          }),
        );
        await deleteModel(results, "OwnedJobPostReviewVersion", () =>
          transaction.jobPostReviewVersion.deleteMany({
            where: { reviewAggregateId: { in: ownedReviewAggregateIds } },
          }),
        );
        await deleteModel(results, "OwnedJobPostReviewAggregate", () =>
          transaction.jobPostReviewAggregate.deleteMany({
            where: { id: { in: ownedReviewAggregateIds } },
          }),
        );
        for (const aggregate of reviewAggregates) {
          if (!reviewAggregateIdsToRestore.includes(aggregate.id)) continue;
          const baseline = baselineByAggregate.get(aggregate.id);
          await transaction.jobPostReviewAggregate.update({
            where: { id: aggregate.id },
            data: {
              latestSequence: baseline?.sequence ?? 1,
              pendingVersionId:
                baseline?.state === "PENDING_REVIEW" ? baseline.id : null,
              approvedVersionId:
                baseline?.state === "APPROVED" ? baseline.id : null,
              closedAt: null,
              closedByUserId: null,
              visibilityState: "PUBLISHED",
              applicationState: "OPEN",
              hiddenAt: null,
              hiddenByUserId: null,
              hiddenReason: null,
              archivedAt: null,
              archivedByUserId: null,
              applicationClosedAt: null,
              applicationClosedByUserId: null,
              softDeletedAt: null,
              softDeletedByUserId: null,
              softDeleteReason: null,
              operationalVersion: { increment: 1 },
              version: { increment: 1 },
            },
          });
        }
        results.push({
          model: "JobPostReviewAggregateState",
          count: reviewAggregateIdsToRestore.length,
          action: "restored to baseline",
        });
        results.push({
          model: "PendingJobPostReviewAssignment",
          count: await distributeUnassignedPendingReviews(transaction, now),
          action: "reassigned",
        });

        const ownedApplicationIds = (
          await transaction.jobApplication.findMany({
            where: { jobPostingId: { in: ownedJobPostingIds } },
            select: { id: true },
          })
        ).map(({ id }) => id);
        const ownedAutomaticMatchResultIds = (
          await transaction.automaticMatchResult.findMany({
            where: { jobApplicationId: { in: ownedApplicationIds } },
            select: { id: true },
          })
        ).map(({ id }) => id);

        // Remove user-owned jobs and companies after review pointers are
        // cleared. Imported catalog rows have no user ownership signal and
        // are intentionally excluded from these filters.
        await deleteModel(results, "MessagingConversationForOwnedJobs", () =>
          transaction.messagingConversation.deleteMany({
            where: {
              OR: [
                { companyId: { in: ownedCompanyIds } },
                { applicationId: { in: ownedApplicationIds } },
              ],
            },
          }),
        );
        await deleteModel(results, "RecruitmentThreadForOwnedJobs", () =>
          transaction.recruitmentThread.deleteMany({
            where: {
              OR: [
                { jobPostingId: { in: ownedJobPostingIds } },
                { companyId: { in: ownedCompanyIds } },
              ],
            },
          }),
        );
        await deleteModel(results, "ExportRequestForOwnedJobs", () =>
          transaction.exportRequest.deleteMany({
            where: {
              OR: [
                { jobPostingId: { in: ownedJobPostingIds } },
                { companyId: { in: ownedCompanyIds } },
              ],
            },
          }),
        );
        await deleteModel(
          results,
          "ApplicationArtifactPromotionForOwnedJobs",
          () =>
            transaction.applicationArtifactPromotion.deleteMany({
              where: { jobPostingId: { in: ownedJobPostingIds } },
            }),
        );
        await deleteModel(results, "SavedJobForOwnedJobs", () =>
          transaction.savedJob.deleteMany({
            where: { jobPostingId: { in: ownedJobPostingIds } },
          }),
        );
        await deleteModel(results, "JobReportForOwnedJobs", () =>
          transaction.jobReport.deleteMany({
            where: { jobPostingId: { in: ownedJobPostingIds } },
          }),
        );
        await deleteModel(
          results,
          "CandidateApplicationDraftForOwnedJobs",
          () =>
            transaction.candidateApplicationDraft.deleteMany({
              where: { jobPostingId: { in: ownedJobPostingIds } },
            }),
        );
        await deleteModel(
          results,
          "JobApplicationAttemptCounterForOwnedJobs",
          () =>
            transaction.jobApplicationAttemptCounter.deleteMany({
              where: { jobPostingId: { in: ownedJobPostingIds } },
            }),
        );
        await deleteModel(results, "JobApplicationForOwnedJobs", () =>
          transaction.jobApplication.deleteMany({
            where: { id: { in: ownedApplicationIds } },
          }),
        );
        await deleteModel(results, "AutomaticMatchResultForOwnedJobs", () =>
          transaction.automaticMatchResult.deleteMany({
            where: { id: { in: ownedAutomaticMatchResultIds } },
          }),
        );
        // Private CV matching stores immutable job identifiers without a
        // relational foreign key, so remove those snapshots explicitly too.
        await deleteModel(results, "PrivateCvMatchCheckForOwnedJobs", () =>
          transaction.privateCvMatchCheck.deleteMany({
            where: { jobPostingId: { in: ownedJobPostingIds } },
          }),
        );
        await deleteModel(results, "JobPostingOwnedByUser", () =>
          transaction.jobPosting.deleteMany({
            where: { id: { in: ownedJobPostingIds } },
          }),
        );

        // Tax identifiers and verification evidence are user-submitted. They
        // must not survive a reset, even when the company itself is shared.
        await deleteModel(results, "RecruiterVerificationRequest", () =>
          transaction.recruiterVerificationRequest.deleteMany({
            where: {
              OR: [
                { applicantUserId: userIdFilter },
                { targetCompanyId: { in: ownedCompanyIds } },
              ],
            },
          }),
        );
        await deleteModel(results, "CompanyContactEmailChallenge", () =>
          transaction.companyContactEmailChallenge.deleteMany({
            where: { applicantUserId: userIdFilter },
          }),
        );
        await deleteModel(results, "BusinessRegistryLookupSnapshot", () =>
          transaction.businessRegistryLookupSnapshot.deleteMany({
            where: { applicantUserId: userIdFilter },
          }),
        );

        const ownedMembershipIds = (
          await transaction.companyMembership.findMany({
            where: { companyId: { in: ownedCompanyIds } },
            select: { id: true },
          })
        ).map(({ id }) => id);
        await deleteModel(results, "OwnedCompanyMembershipHistory", () =>
          transaction.companyMembershipHistory.deleteMany({
            where: { membershipId: { in: ownedMembershipIds } },
          }),
        );
        await deleteModel(results, "OwnedCompanyMembership", () =>
          transaction.companyMembership.deleteMany({
            where: { id: { in: ownedMembershipIds } },
          }),
        );
        await deleteModel(results, "CompanyOwnedByUser", () =>
          transaction.company.deleteMany({
            where: { id: { in: ownedCompanyIds } },
          }),
        );

        const membershipIds = (
          await transaction.companyMembership.findMany({
            where: {
              userId: userIdFilter,
              id: { notIn: protectedMembershipIds },
            },
            select: { id: true },
          })
        ).map(({ id }) => id);
        await deleteModel(results, "CompanyMembershipHistory", () =>
          transaction.companyMembershipHistory.deleteMany({
            where: { membershipId: { in: membershipIds } },
          }),
        );
        await deleteModel(results, "CompanyMembership", () =>
          transaction.companyMembership.deleteMany({
            where: { id: { in: membershipIds } },
          }),
        );

        // Keep the account row because local company and job history can
        // reference it, but remove every credential and release the original
        // email address for a clean local sign-up.
        await deleteModel(results, "AuthProviderAccount", () =>
          transaction.authProviderAccount.deleteMany({
            where: { userId: userIdFilter },
          }),
        );
        await deleteModel(results, "Session", () =>
          transaction.session.deleteMany({ where: { userId: userIdFilter } }),
        );
        await deleteModel(results, "Verification", () =>
          transaction.verification.deleteMany({
            where: { userId: userIdFilter },
          }),
        );
        await deleteModel(results, "TwoFactor", () =>
          transaction.twoFactor.deleteMany({ where: { userId: userIdFilter } }),
        );
        await deleteModel(results, "AuthenticationChallenge", () =>
          transaction.authenticationChallenge.deleteMany({
            where: { userId: userIdFilter },
          }),
        );
        await deleteModel(results, "FullAccountRecoveryOperation", () =>
          transaction.fullAccountRecoveryOperation.deleteMany({
            where: { userId: userIdFilter },
          }),
        );
        await deleteModel(results, "PasswordResetOperation", () =>
          transaction.passwordResetOperation.deleteMany({
            where: { userId: userIdFilter },
          }),
        );
        await deleteModel(results, "SecurityToken", () =>
          transaction.securityToken.deleteMany({
            where: { userId: userIdFilter },
          }),
        );
        await deleteModel(results, "PasswordChangeOperation", () =>
          transaction.passwordChangeOperation.deleteMany({
            where: { userId: userIdFilter },
          }),
        );
        await deleteModel(results, "PasswordChangeAttemptWindow", () =>
          transaction.passwordChangeAttemptWindow.deleteMany({
            where: { userId: userIdFilter },
          }),
        );
        await deleteModel(results, "EmailChangeRequest", () =>
          transaction.emailChangeRequest.deleteMany({
            where: { userId: userIdFilter },
          }),
        );
        // Prevent queued messages that still contain the prior recipient from
        // being delivered after the account is reset.
        await deleteModel(results, "EmailOutbox", () =>
          transaction.emailOutbox.deleteMany({
            where: { userId: userIdFilter },
          }),
        );
        await deleteModel(results, "AccountPreferences", () =>
          transaction.accountPreferences.deleteMany({
            where: { userId: userIdFilter },
          }),
        );

        await deleteModel(results, "UserJobWorkspaceState", () =>
          transaction.userJobWorkspaceState.deleteMany({
            where: { userId: userIdFilter },
          }),
        );

        // Saved jobs and applied jobs are deleted before their user-owned
        // candidate/CV records. Application children must go first.
        await deleteModel(results, "SavedJob", () =>
          transaction.savedJob.deleteMany({ where: { userId: userIdFilter } }),
        );
        await deleteModel(results, "JobReport", () =>
          transaction.jobReport.deleteMany({
            where: { reporterUserId: userIdFilter },
          }),
        );
        await deleteModel(results, "CandidateApplicationDraft", () =>
          transaction.candidateApplicationDraft.deleteMany({
            where: { candidateUserId: userIdFilter },
          }),
        );
        await deleteModel(results, "JobApplicationAttemptCounter", () =>
          transaction.jobApplicationAttemptCounter.deleteMany({
            where: { candidateUserId: userIdFilter },
          }),
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
            where: { candidateUserId: userIdFilter },
          }),
        );

        // CV workflow children must be deleted before uploads and artifacts.
        await deleteModel(results, "CvImportConfirmation", () =>
          transaction.cvImportConfirmation.deleteMany({
            where: { accountId: userIdFilter },
          }),
        );
        await deleteModel(results, "CvDraft", () =>
          transaction.cvDraft.deleteMany({
            where: { accountId: userIdFilter },
          }),
        );
        await deleteModel(results, "CvRetryRequest", () =>
          transaction.cvRetryRequest.deleteMany({
            where: { accountId: userIdFilter },
          }),
        );
        await deleteModel(results, "CvParseJob", () =>
          transaction.cvParseJob.deleteMany({
            where: { accountId: userIdFilter },
          }),
        );
        // Parse jobs reference consent with ON DELETE SET NULL, but terminal
        // parse rows require consent for external-parser states. Delete the
        // parse jobs first so removing consent does not perform that invalid
        // intermediate update.
        await deleteModel(results, "CvProcessingConsent", () =>
          transaction.cvProcessingConsent.deleteMany({
            where: { accountId: userIdFilter },
          }),
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
          transaction.cvExtraction.deleteMany({
            where: { accountId: userIdFilter },
          }),
        );
        await deleteModel(results, "CvScanAssessment", () =>
          transaction.cvScanAssessment.deleteMany({
            where: { accountId: userIdFilter },
          }),
        );
        await deleteModel(results, "CvStoredArtifact", () =>
          transaction.cvStoredArtifact.deleteMany({
            where: { accountId: userIdFilter },
          }),
        );
        await deleteModel(results, "CvUpload", () =>
          transaction.cvUpload.deleteMany({
            where: { accountId: userIdFilter },
          }),
        );
        await deleteModel(results, "CvAccountQuota", () =>
          transaction.cvAccountQuota.deleteMany({
            where: { accountId: userIdFilter },
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
        await deleteModel(results, "CandidateIdentity", () =>
          transaction.candidateIdentity.deleteMany({
            where: { userId: userIdFilter },
          }),
        );
        for (const userId of userIds) {
          const resetEmail = resetEmailFor(userId);
          await transaction.userAccount.update({
            where: { id: userId },
            data: {
              name: "Reset user",
              email: resetEmail,
              normalizedEmail: resetEmail,
              emailVerified: false,
              image: null,
              state: "DELETED",
              twoFactorEnabled: false,
              stateChangedAt: now,
              deletedAt: now,
              version: { increment: 1 },
            },
          });
        }
        results.push({
          model: "UserAccountCredentials",
          count: userIds.length,
        });

        return results;
      },
      { maxWait: 30_000, timeout: 180_000 },
    );
    const localCatalogue = await purgeLocalUserCatalogue(resolvedUserIds);

    const scopeLabel = requestedUserRef
      ? `user ${requestedUserRef}`
      : resolvedUserIds.length > 0
        ? `all ${resolvedUserIds.length} local user accounts`
        : "no user found; nothing to reset";
    console.log(`[db:reset:user] Scope: ${scopeLabel}.`);
    for (const { model, count, action: resultAction } of deletions) {
      const action =
        resultAction ??
        (model === "UserAccountCredentials"
          ? "account(s) anonymized"
          : "record(s) deleted");
      console.log(`[db:reset:user] ${model}: ${count} ${action}.`);
    }
    console.log(
      "[db:reset:user] SuggestedJob: no persisted model in schema; 0 record(s) affected (computed dynamically).",
    );
    console.log(
      "[db:reset:user] Skill: shared catalog retained; user skill links were deleted via CandidateProfileSkill.",
    );
    console.log(
      `[db:reset:user] Local catalogue: removed ${localCatalogue.companies} companies, ${localCatalogue.jobs} jobs, and ${localCatalogue.applications} applications.`,
    );
    console.log(
      `[db:reset:user] Completed for ${scopeLabel}. Shared job/company/skill catalog data was retained; owned records, the original email, and authentication credentials were removed.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
