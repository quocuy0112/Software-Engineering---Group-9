import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const companiesPath = resolve(root, "data/jobs/companies.json");
const jobsPath = resolve(root, "data/jobs/jobs.json");
const userStatePath = resolve(root, "data/jobs/user-job-state.json");
const compassId = "comp-0115-compass-capital";
const confirmedDemoRecruiterId = process.env.DEMO_RECRUITER_USER_ID ?? "80d7f7f3-aff9-41a3-bf3d-5d7a36400fac";

async function readJson(path) { return JSON.parse(await readFile(path, "utf8")); }
async function writeJson(path, value) { await writeFile(path, JSON.stringify(value, null, 2) + "\n", "utf8"); }
function deterministicTaxCode(company, index) {
  const digest = createHash("sha256").update([company.id, company.slug, index].join(":"), "utf8").digest("hex");
  return (BigInt("0x" + digest.slice(0, 16)) % 10_000_000_000n).toString().padStart(10, "0");
}
function isEligibleDemoJob(job) { return ["open", "closing_soon", "active"].includes(job.status); }
function addApprovalComment(job) { return Object.prototype.hasOwnProperty.call(job, "approvalComment") ? job : { ...job, approvalComment: null }; }

const [companies, jobs, userState] = await Promise.all([readJson(companiesPath), readJson(jobsPath), readJson(userStatePath)]);
const migratedCompanies = companies.map((company, index) => ({
  ...company,
  ownerUserId: company.id === compassId ? confirmedDemoRecruiterId : null,
  memberUserIds: Array.from(new Set(company.memberUserIds ?? [])),
  taxCode: typeof company.taxCode === "string" && /^\d{10}$/.test(company.taxCode) ? company.taxCode : deterministicTaxCode(company, index),
  verificationStatus: company.verificationStatus === "pending" || company.verificationStatus === "rejected" ? company.verificationStatus : "approved",
}));
const compassJobs = jobs.filter((job) => job.companyId === compassId).sort((left, right) => left.id.localeCompare(right.id));
const pendingExists = compassJobs.some((job) => job.status === "pending_approval");
const rejectedExists = compassJobs.some((job) => job.status === "rejected");
const seedCandidates = compassJobs.filter(isEligibleDemoJob);
const pendingId = seedCandidates[0]?.id;
const rejectedId = seedCandidates.find((job) => job.id !== pendingId)?.id;
let pendingSeeded = pendingExists;
let rejectedSeeded = rejectedExists;
const migratedJobs = jobs.map((rawJob) => {
  const job = addApprovalComment(rawJob);
  if (job.id === pendingId && !pendingExists) { pendingSeeded = true; return { ...job, status: "pending_approval", approvalComment: null }; }
  if (job.id === rejectedId && !rejectedExists) { rejectedSeeded = true; return { ...job, status: "rejected", approvalComment: "Please clarify the salary band and complete the required work-location details before resubmitting." }; }
  return job;
});
const saved = new Set(userState.savedJobIds ?? []);
const hidden = new Set(userState.hiddenJobIds ?? []);
const validAppliedIds = new Set(migratedJobs.filter((job) => !["closed", "filled", "expired", "rejected"].includes(job.status)).map((job) => job.id));
let appliedJobIds = Array.isArray(userState.appliedJobIds) ? Array.from(new Set(userState.appliedJobIds.filter((id) => validAppliedIds.has(id)))) : [];
if (appliedJobIds.length === 0) {
  appliedJobIds = migratedJobs.filter((job) => validAppliedIds.has(job.id) && !saved.has(job.id) && !hidden.has(job.id)).sort((left, right) => left.id.localeCompare(right.id)).slice(0, 2).map((job) => job.id);
}
await Promise.all([writeJson(companiesPath, migratedCompanies), writeJson(jobsPath, migratedJobs), writeJson(userStatePath, { ...userState, appliedJobIds })]);
console.log(JSON.stringify({ companies: migratedCompanies.length, jobs: migratedJobs.length, demoRecruiterUserId: confirmedDemoRecruiterId, compassCompanyId: compassId, pendingSeeded, rejectedSeeded, appliedJobIds }, null, 2));
