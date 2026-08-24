import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const companiesPath = resolve(root, "data/companies/companies.json");
const jobsPath = resolve(root, "data/jobs/jobs.json");
const userStatePath = resolve(root, "data/user/user-job-state.json");
const compassId = "comp-0115-compass-capital";
const confirmedDemoRecruiterId =
  process.env.DEMO_RECRUITER_USER_ID ?? "80d7f7f3-aff9-41a3-bf3d-5d7a36400fac";

async function readJson(path) {
  const text = await readFile(path, "utf8");
  return JSON.parse(text);
}
async function readOptionalJson(path, fallback) {
  const text = await readFile(path, "utf8");
  return text.trim() ? JSON.parse(text) : fallback;
}
async function writeJson(path, value) {
  await writeFile(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}
async function readJobsCatalogue() {
  try {
    return { jobs: await readJson(jobsPath), splitPaths: null };
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    const entries = await readdir(resolve(root, "data/jobs"), {
      withFileTypes: true,
    });
    const splitPaths = entries
      .filter(
        (entry) => entry.isFile() && /^jobs_.+_r\d{2}\.json$/u.test(entry.name),
      )
      .map((entry) => resolve(root, "data/jobs", entry.name))
      .sort((left, right) => left.localeCompare(right));
    if (splitPaths.length !== 29) {
      throw new Error(
        "jobs.json is missing and the 29 split industry files are incomplete.",
        { cause: error },
      );
    }
    const documents = await Promise.all(
      splitPaths.map((path) => readJson(path)),
    );
    return {
      jobs: documents.flatMap((document) => {
        if (!Array.isArray(document))
          throw new Error("A split jobs file must contain an array.");
        return document;
      }),
      splitPaths,
    };
  }
}
async function writeJobsCatalogue(splitPaths, jobs) {
  if (!splitPaths) return writeJson(jobsPath, jobs);
  const byCode = new Map(
    splitPaths.map((path) => [path.match(/_(r\d{2})\.json$/u)?.[1], []]),
  );
  for (const job of jobs) {
    const code = job?.industryCode;
    if (!byCode.has(code))
      throw new Error("Job has an unsupported industryCode: " + code);
    byCode.get(code).push(job);
  }
  await Promise.all(
    splitPaths.map((path) =>
      writeJson(path, byCode.get(path.match(/_(r\d{2})\.json$/u)?.[1]) ?? []),
    ),
  );
}
function deterministicTaxCode(company, index) {
  const digest = createHash("sha256")
    .update([company.id, company.slug, index].join(":"), "utf8")
    .digest("hex");
  return (BigInt("0x" + digest.slice(0, 16)) % 10_000_000_000n)
    .toString()
    .padStart(10, "0");
}
function isEligibleDemoJob(job) {
  return ["open", "closing_soon", "active"].includes(job.status);
}
function addApprovalComment(job) {
  return Object.prototype.hasOwnProperty.call(job, "approvalComment")
    ? job
    : { ...job, approvalComment: null };
}

const [{ jobs, splitPaths }, companies, userState] = await Promise.all([
  readJobsCatalogue(),
  readJson(companiesPath),
  readOptionalJson(userStatePath, {}),
]);
const migratedCompanies = companies.map((company, index) => ({
  ...company,
  ownerUserId: company.id === compassId ? confirmedDemoRecruiterId : null,
  memberUserIds: Array.from(new Set(company.memberUserIds ?? [])),
  taxCode:
    typeof company.taxCode === "string" && /^\d{10}$/.test(company.taxCode)
      ? company.taxCode
      : deterministicTaxCode(company, index),
  verificationStatus:
    company.verificationStatus === "pending" ||
    company.verificationStatus === "rejected"
      ? company.verificationStatus
      : "approved",
}));
const compassJobs = jobs
  .filter((job) => job.companyId === compassId)
  .sort((left, right) => left.id.localeCompare(right.id));
const pendingExists = compassJobs.some(
  (job) => job.status === "pending_approval",
);
const rejectedExists = compassJobs.some((job) => job.status === "rejected");
const seedCandidates = compassJobs.filter(isEligibleDemoJob);
const pendingId = seedCandidates[0]?.id;
const rejectedId = seedCandidates.find((job) => job.id !== pendingId)?.id;
let pendingSeeded = pendingExists;
let rejectedSeeded = rejectedExists;
const migratedJobs = jobs.map((rawJob) => {
  const job = addApprovalComment(rawJob);
  if (job.id === pendingId && !pendingExists) {
    pendingSeeded = true;
    return { ...job, status: "pending_approval", approvalComment: null };
  }
  if (job.id === rejectedId && !rejectedExists) {
    rejectedSeeded = true;
    return {
      ...job,
      status: "rejected",
      approvalComment:
        "Please clarify the salary band and complete the required work-location details before resubmitting.",
    };
  }
  return job;
});
const saved = new Set(userState.savedJobIds ?? []);
const hidden = new Set(userState.hiddenJobIds ?? []);
const validAppliedIds = new Set(
  migratedJobs
    .filter(
      (job) =>
        !["closed", "filled", "expired", "rejected"].includes(job.status),
    )
    .map((job) => job.id),
);
let appliedJobIds = Array.isArray(userState.appliedJobIds)
  ? Array.from(
      new Set(userState.appliedJobIds.filter((id) => validAppliedIds.has(id))),
    )
  : [];
if (appliedJobIds.length === 0) {
  appliedJobIds = migratedJobs
    .filter(
      (job) =>
        validAppliedIds.has(job.id) &&
        !saved.has(job.id) &&
        !hidden.has(job.id),
    )
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, 2)
    .map((job) => job.id);
}
await Promise.all([
  writeJson(companiesPath, migratedCompanies),
  writeJobsCatalogue(splitPaths, migratedJobs),
  writeJson(userStatePath, { ...userState, appliedJobIds }),
]);
console.log(
  JSON.stringify(
    {
      companies: migratedCompanies.length,
      jobs: migratedJobs.length,
      demoRecruiterUserId: confirmedDemoRecruiterId,
      compassCompanyId: compassId,
      pendingSeeded,
      rejectedSeeded,
      appliedJobIds,
    },
    null,
    2,
  ),
);
