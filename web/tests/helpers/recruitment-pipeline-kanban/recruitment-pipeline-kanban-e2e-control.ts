import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type RecruitmentPipelineKanbanE2EFixture = Readonly<{
  companyId: string;
  membershipId: string;
  recruiter: Readonly<{ userId: string; email: string; name: string }>;
  jobs: Readonly<{
    active: Readonly<{ requestedId: string; canonicalId: string; title: string }>;
    closed: Readonly<{ requestedId: string; canonicalId: string; title: string }>;
  }>;
  applications: Readonly<{
    ordinary: Readonly<{ id: string; candidateName: string }>;
    rejection: Readonly<{ id: string; candidateName: string }>;
    stale: Readonly<{ id: string; candidateName: string }>;
    unavailable: Readonly<{ id: string; candidateName: string }>;
    hired: Readonly<{ id: string; candidateName: string }>;
  }>;
}>;

type ControlCommand = "create" | "delete" | "advance-stale" | "revoke-membership";

export async function runRecruitmentPipelineKanbanE2EControl<T>(
  command: ControlCommand,
  payload: unknown = null,
) {
  const script = resolve(
    process.cwd(),
    "tests/helpers/recruitment-pipeline-kanban/recruitment-pipeline-kanban-e2e-control.mjs",
  );
  const bootstrap = resolve(
    process.cwd(),
    "tests/helpers/recruitment-pipeline-kanban/windows-tsx-bootstrap.mjs",
  );
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "--conditions=react-server",
      "--import",
      pathToFileURL(bootstrap).href,
      "--import",
      "tsx",
      script,
      command,
      encoded,
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: 4 * 1024 * 1024,
      timeout: 120_000,
      windowsHide: true,
    },
  );
  const resultLine = stdout
    .split(/\r?\n/u)
    .findLast((line) => line.startsWith("__FEATURE_019_RESULT__"));
  if (!resultLine) throw new Error("FEATURE_019_E2E_CONTROL_RESULT_MISSING");
  return JSON.parse(resultLine.slice("__FEATURE_019_RESULT__".length)) as T;
}
