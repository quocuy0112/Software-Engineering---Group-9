import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";

import {
  GetPolicyCommand,
  GetPolicyVersionCommand,
  GetRolePolicyCommand,
  IAMClient,
  ListAttachedRolePoliciesCommand,
  ListRolePoliciesCommand,
} from "@aws-sdk/client-iam";
import { GetKeyPolicyCommand, KMSClient } from "@aws-sdk/client-kms";
import {
  GetBucketEncryptionCommand,
  GetBucketLifecycleConfigurationCommand,
  GetBucketPolicyStatusCommand,
  GetPublicAccessBlockCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import dotenv from "dotenv";

import { verifyProductionStoragePreflight } from "../src/backend/image-search/storage/production-preflight.ts";
import { recordImageSearchOperationalEvidence } from "../src/backend/services/image-search/image-search-admission-readiness.ts";

dotenv.config({ path: resolve(process.cwd(), "../.env") });
dotenv.config({ path: resolve(process.cwd(), ".env.local"), override: true });

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`IMAGE_SEARCH_PREFLIGHT_MISSING_${name}`);
  return value;
}

function list(value) {
  if (Array.isArray(value)) return value.map(String);
  return value === undefined ? [] : [String(value)];
}

function policyDocument(encoded) {
  if (!encoded) throw new Error("IMAGE_SEARCH_PREFLIGHT_POLICY_MISSING");
  return JSON.parse(decodeURIComponent(encoded));
}

function statements(document) {
  return list(document.Statement).flatMap((statement) =>
    typeof statement === "object" && statement ? [statement] : [],
  );
}

function normalizedStatements(documents) {
  return documents.flatMap(statements).map((statement) => ({
    effect: String(statement.Effect ?? ""),
    actions: list(statement.Action),
    resources: list(statement.Resource),
    prefixCondition:
      statement.Condition?.StringLike?.["s3:prefix"]?.[0] ??
      statement.Condition?.StringLike?.["s3:prefix"],
  }));
}

function kmsPolicySummary(document, roleArn, kmsKeyId) {
  const entries = statements(document);
  const publicPrincipal = entries.some((entry) => {
    const principal = entry.Principal;
    return principal === "*" || principal?.AWS === "*";
  });
  const allowed = entries.filter((entry) => {
    const principals = list(entry.Principal?.AWS ?? entry.Principal);
    return entry.Effect === "Allow" && principals.includes(roleArn);
  });
  return {
    keyId: kmsKeyId,
    allowedPrincipalArns: allowed.length ? [roleArn] : [],
    allowedActions: [
      ...new Set(allowed.flatMap((entry) => list(entry.Action))),
    ],
    publicPrincipal,
  };
}

async function rolePolicies(client, roleName) {
  const documents = [];
  const inline = await client.send(
    new ListRolePoliciesCommand({ RoleName: roleName }),
  );
  for (const policyName of inline.PolicyNames ?? []) {
    const policy = await client.send(
      new GetRolePolicyCommand({ RoleName: roleName, PolicyName: policyName }),
    );
    documents.push(policyDocument(policy.PolicyDocument));
  }
  const attached = await client.send(
    new ListAttachedRolePoliciesCommand({ RoleName: roleName }),
  );
  for (const item of attached.AttachedPolicies ?? []) {
    if (!item.PolicyArn) continue;
    const policy = await client.send(
      new GetPolicyCommand({ PolicyArn: item.PolicyArn }),
    );
    const versionId = policy.Policy?.DefaultVersionId;
    if (!versionId) continue;
    const version = await client.send(
      new GetPolicyVersionCommand({
        PolicyArn: item.PolicyArn,
        VersionId: versionId,
      }),
    );
    documents.push(policyDocument(version.PolicyVersion?.Document));
  }
  return documents;
}

async function main() {
  const expected = {
    bucket: required("IMAGE_SEARCH_S3_BUCKET"),
    region: required("IMAGE_SEARCH_S3_REGION"),
    prefix: required("IMAGE_SEARCH_S3_PREFIX"),
    kmsKeyId: required("IMAGE_SEARCH_S3_KMS_KEY_ID"),
    workerRoleArn: required("IMAGE_SEARCH_S3_WORKER_ROLE_ARN"),
  };
  if (!expected.prefix.endsWith("/") || expected.prefix.startsWith("/")) {
    throw new Error("IMAGE_SEARCH_PREFLIGHT_PREFIX_INVALID");
  }
  const roleName = expected.workerRoleArn.split("/").at(-1);
  if (!roleName) throw new Error("IMAGE_SEARCH_PREFLIGHT_ROLE_INVALID");
  const s3 = new S3Client({ region: expected.region });
  const iam = new IAMClient({ region: expected.region });
  const kms = new KMSClient({ region: expected.region });
  const [
    publicAccess,
    policyStatus,
    encryption,
    lifecycle,
    policies,
    keyPolicy,
  ] = await Promise.all([
    s3.send(new GetPublicAccessBlockCommand({ Bucket: expected.bucket })),
    s3.send(new GetBucketPolicyStatusCommand({ Bucket: expected.bucket })),
    s3.send(new GetBucketEncryptionCommand({ Bucket: expected.bucket })),
    s3.send(
      new GetBucketLifecycleConfigurationCommand({ Bucket: expected.bucket }),
    ),
    rolePolicies(iam, roleName),
    kms.send(
      new GetKeyPolicyCommand({
        KeyId: expected.kmsKeyId,
        PolicyName: "default",
      }),
    ),
  ]);
  const encryptionRule =
    encryption.ServerSideEncryptionConfiguration?.Rules?.[0];
  const snapshot = {
    publicAccessBlock: {
      blockPublicAcls:
        publicAccess.PublicAccessBlockConfiguration?.BlockPublicAcls === true,
      ignorePublicAcls:
        publicAccess.PublicAccessBlockConfiguration?.IgnorePublicAcls === true,
      blockPublicPolicy:
        publicAccess.PublicAccessBlockConfiguration?.BlockPublicPolicy === true,
      restrictPublicBuckets:
        publicAccess.PublicAccessBlockConfiguration?.RestrictPublicBuckets ===
        true,
    },
    bucketPolicyPublic: policyStatus.PolicyStatus?.IsPublic !== false,
    defaultEncryption: {
      algorithm:
        encryptionRule?.ApplyServerSideEncryptionByDefault?.SSEAlgorithm ?? "",
      kmsKeyId:
        encryptionRule?.ApplyServerSideEncryptionByDefault?.KMSMasterKeyID ??
        "",
      bucketKeyEnabled: encryptionRule?.BucketKeyEnabled === true,
    },
    lifecycleRules: (lifecycle.Rules ?? []).map((rule) => ({
      enabled: rule.Status === "Enabled",
      prefix: rule.Filter?.Prefix ?? rule.Prefix ?? "",
      expirationDays: rule.Expiration?.Days ?? 0,
      noncurrentExpirationDays:
        rule.NoncurrentVersionExpiration?.NoncurrentDays ?? 0,
      abortIncompleteMultipartUploadDays:
        rule.AbortIncompleteMultipartUpload?.DaysAfterInitiation ?? 0,
    })),
    workerPolicy: { statements: normalizedStatements(policies) },
    kmsKeyPolicy: kmsPolicySummary(
      JSON.parse(keyPolicy.Policy ?? "{}"),
      expected.workerRoleArn,
      expected.kmsKeyId,
    ),
    inspectedAt: new Date(),
  };
  const report = verifyProductionStoragePreflight(
    snapshot,
    expected,
    new Date(),
  );
  const output = resolve(
    process.cwd(),
    ".local/evidence/image-search-storage-preflight.json",
  );
  await mkdir(dirname(output), { recursive: true, mode: 0o700 });
  const reportBytes = Buffer.from(
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  await writeFile(output, reportBytes, {
    encoding: "utf8",
    mode: 0o600,
  });
  await recordImageSearchOperationalEvidence({
    component: "STORAGE_PREFLIGHT",
    evidenceVersion: report.schemaVersion,
    evidenceDigest: createHash("sha256").update(reportBytes).digest(),
    succeededAt: new Date(report.inspectedAt),
    validForMs: 15 * 60_000,
  });
  process.stdout.write(
    `Production image-search storage preflight PASS: ${output}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "IMAGE_SEARCH_PREFLIGHT_FAILED"}\n`,
  );
  process.exitCode = 1;
});
