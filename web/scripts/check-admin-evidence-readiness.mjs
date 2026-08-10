import { accessSync, constants } from "node:fs";
import { isAbsolute } from "node:path";

const env = process.env;
const production = env.APP_ENV === "production";
const failures = [];
const pass = (condition, message) => {
  console.log(`${condition ? "PASS" : "FAIL"} ${message}`);
  if (!condition) failures.push(message);
};
const strictTrue = (name) => env[name] === "true";
const namedPerson = (name) =>
  typeof env[name] === "string" &&
  env[name].trim().length >= 3 &&
  !/^(pending|tbd|legal|security|operations)$/iu.test(env[name].trim());
const exactOrigin = (value) => {
  try {
    const url = new URL(value);
    return (
      url.origin === value &&
      !url.hostname.includes("*") &&
      (!production || url.protocol === "https:")
    );
  } catch {
    return false;
  }
};

const origins = [env.CANDIDATE_ORIGIN, env.ADMIN_ORIGIN, env.RECRUITER_ORIGIN];
pass(
  origins.every(exactOrigin),
  "candidate/admin/recruiter origins are exact and production HTTPS",
);
pass(
  new Set(origins).size === 3,
  "candidate/admin/recruiter origins are distinct",
);
pass(
  !Object.keys(env).some((key) =>
    key.startsWith("NEXT_PUBLIC_ADMIN_EVIDENCE_"),
  ),
  "evidence configuration is server-only",
);
pass(
  env.ADMIN_EVIDENCE_POLICY_VERSION === "business-license-evidence-v1",
  "approved evidence-policy version is exact",
);
for (const functionName of ["LEGAL", "SECURITY", "OPERATIONS"]) {
  pass(
    namedPerson(`ADMIN_EVIDENCE_${functionName}_APPROVER`) &&
      strictTrue(`ADMIN_EVIDENCE_${functionName}_APPROVED`),
    `${functionName.toLowerCase()} has a named evidence-policy approval`,
  );
}

const decodedKey = (() => {
  try {
    return Buffer.from(env.ADMIN_EVIDENCE_KEY_V1 ?? "", "base64");
  } catch {
    return Buffer.alloc(0);
  }
})();
pass(
  decodedKey.length === 32,
  "evidence encryption key decodes to exactly 32 bytes",
);
pass(
  env.ADMIN_CLAMD_SOCKET_PATH === "/run/clamav/clamd.sock",
  "evidence scanner uses the fixed private socket",
);
pass(
  strictTrue("ADMIN_NOTIFICATION_ENABLED"),
  "applicant/security notification delivery is enabled",
);
pass(strictTrue("ADMIN_WORKER_ENABLED"), "admin lifecycle worker is enabled");
pass(
  env.ADMIN_EVIDENCE_TERMINAL_DELETE_HOURS === "24" &&
    env.ADMIN_EVIDENCE_INACTIVE_APPROVAL_DELETE_DAYS === "30",
  "evidence retention deadlines are fixed at 24 hours and 30 days",
);

if (production) {
  const workloadCredentials = ![
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
  ].some((name) => Boolean(env[name]));
  pass(
    env.ADMIN_EVIDENCE_STORAGE_ADAPTER === "s3",
    "production uses private S3 evidence storage",
  );
  pass(
    workloadCredentials,
    "production uses workload identity instead of static AWS credentials",
  );
  pass(
    Boolean(
      /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(
        env.ADMIN_EVIDENCE_S3_BUCKET ?? "",
      ) &&
      /^[a-z]{2}(?:-gov)?-[a-z]+-\d$/u.test(
        env.ADMIN_EVIDENCE_S3_REGION ?? "",
      ) &&
      env.ADMIN_EVIDENCE_S3_KMS_KEY_ID &&
      !env.ADMIN_EVIDENCE_S3_KMS_KEY_ID.includes("aws/s3"),
    ),
    "production bucket, region, and customer-managed KMS key are explicit",
  );
} else {
  const privateRoot = (() => {
    try {
      const valid =
        env.ADMIN_EVIDENCE_STORAGE_ADAPTER === "filesystem" &&
        isAbsolute(env.ADMIN_EVIDENCE_STORAGE_ROOT ?? "");
      if (!valid) return false;
      accessSync(
        env.ADMIN_EVIDENCE_STORAGE_ROOT,
        constants.R_OK | constants.W_OK,
      );
      return true;
    } catch {
      return false;
    }
  })();
  pass(
    privateRoot,
    "local evidence root is absolute, private-configured, and readable/writable",
  );
}

pass(
  Boolean(env.ADMIN_COMPANY_PREREQUISITE_OWNER?.trim()) &&
    Boolean(env.ADMIN_COMPANY_PREREQUISITE_VERSION?.trim()) &&
    strictTrue("ADMIN_COMPANY_PREREQUISITE_READY"),
  "company-access prerequisite owner, version, and target-environment readiness are recorded",
);

if (failures.length) {
  console.error(`Admin evidence readiness failed (${failures.length} checks).`);
  process.exit(1);
}
console.log(
  "Admin evidence readiness passed; no secret values were displayed.",
);
