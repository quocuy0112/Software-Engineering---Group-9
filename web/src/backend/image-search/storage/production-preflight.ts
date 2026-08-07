export type ProductionStorageSnapshot = Readonly<{
  publicAccessBlock: Readonly<{
    blockPublicAcls: boolean;
    ignorePublicAcls: boolean;
    blockPublicPolicy: boolean;
    restrictPublicBuckets: boolean;
  }>;
  bucketPolicyPublic: boolean;
  defaultEncryption: Readonly<{
    algorithm: string;
    kmsKeyId: string;
    bucketKeyEnabled: boolean;
  }>;
  lifecycleRules: readonly Readonly<{
    enabled: boolean;
    prefix: string;
    expirationDays: number;
    noncurrentExpirationDays: number;
    abortIncompleteMultipartUploadDays: number;
  }>[];
  workerPolicy: Readonly<{
    statements: readonly Readonly<{
      effect: string;
      actions: readonly string[];
      resources: readonly string[];
      prefixCondition?: string;
    }>[];
  }>;
  kmsKeyPolicy: Readonly<{
    keyId: string;
    allowedPrincipalArns: readonly string[];
    allowedActions: readonly string[];
    publicPrincipal: boolean;
  }>;
  inspectedAt: Date;
}>;

type Expected = Readonly<{
  bucket: string;
  prefix: string;
  kmsKeyId: string;
  workerRoleArn: string;
}>;

const EXPECTED_KMS_ACTIONS = [
  "kms:Decrypt",
  "kms:Encrypt",
  "kms:GenerateDataKey",
] as const;
const EXPECTED_OBJECT_ACTIONS = [
  "s3:AbortMultipartUpload",
  "s3:DeleteObject",
  "s3:GetObject",
  "s3:PutObject",
] as const;

function exactSet(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return (
    actual.length === expected.length &&
    [...actual]
      .sort()
      .every((value, index) => value === [...expected].sort()[index])
  );
}

export function verifyProductionStoragePreflight(
  snapshot: ProductionStorageSnapshot,
  expected: Expected,
  now: Date,
) {
  if (now.getTime() - snapshot.inspectedAt.getTime() > 15 * 60_000) {
    throw new Error("STORAGE_PREFLIGHT_SNAPSHOT_STALE");
  }
  if (!Object.values(snapshot.publicAccessBlock).every(Boolean)) {
    throw new Error("S3_BLOCK_PUBLIC_ACCESS_REQUIRED");
  }
  if (snapshot.bucketPolicyPublic) {
    throw new Error("S3_PUBLIC_POLICY_FORBIDDEN");
  }
  if (
    snapshot.defaultEncryption.algorithm !== "aws:kms" ||
    snapshot.defaultEncryption.kmsKeyId !== expected.kmsKeyId ||
    !snapshot.defaultEncryption.bucketKeyEnabled
  ) {
    throw new Error("S3_SSE_KMS_POLICY_INVALID");
  }
  const bucketArn = `arn:aws:s3:::${expected.bucket}`;
  const objectArn = `${bucketArn}/${expected.prefix}*`;
  const list = snapshot.workerPolicy.statements.find(
    (statement) =>
      statement.effect === "Allow" &&
      exactSet(statement.actions, ["s3:ListBucket"]) &&
      exactSet(statement.resources, [bucketArn]) &&
      statement.prefixCondition === `${expected.prefix}*`,
  );
  const object = snapshot.workerPolicy.statements.find(
    (statement) =>
      statement.effect === "Allow" &&
      exactSet(statement.actions, EXPECTED_OBJECT_ACTIONS) &&
      exactSet(statement.resources, [objectArn]),
  );
  const kms = snapshot.workerPolicy.statements.find(
    (statement) =>
      statement.effect === "Allow" &&
      exactSet(statement.actions, EXPECTED_KMS_ACTIONS) &&
      exactSet(statement.resources, [expected.kmsKeyId]),
  );
  if (
    !list ||
    !object ||
    !kms ||
    snapshot.workerPolicy.statements.length !== 3
  ) {
    throw new Error("IAM_LEAST_PRIVILEGE_POLICY_INVALID");
  }
  if (
    snapshot.kmsKeyPolicy.keyId !== expected.kmsKeyId ||
    snapshot.kmsKeyPolicy.publicPrincipal ||
    !exactSet(snapshot.kmsKeyPolicy.allowedPrincipalArns, [
      expected.workerRoleArn,
    ]) ||
    !exactSet(snapshot.kmsKeyPolicy.allowedActions, EXPECTED_KMS_ACTIONS)
  ) {
    throw new Error("KMS_KEY_POLICY_INVALID");
  }
  const lifecycle = snapshot.lifecycleRules.find(
    (rule) =>
      rule.enabled &&
      rule.prefix === expected.prefix &&
      rule.expirationDays === 1 &&
      rule.noncurrentExpirationDays === 1 &&
      rule.abortIncompleteMultipartUploadDays === 1,
  );
  if (!lifecycle) throw new Error("S3_LIFECYCLE_BACKSTOP_INVALID");
  return {
    schemaVersion: "image-search-storage-preflight-v1" as const,
    status: "PASS" as const,
    inspectedAt: snapshot.inspectedAt.toISOString(),
    validUntil: new Date(
      snapshot.inspectedAt.getTime() + 15 * 60_000,
    ).toISOString(),
    bucket: expected.bucket,
    prefix: expected.prefix,
    kmsKeyId: expected.kmsKeyId,
    workerRoleArn: expected.workerRoleArn,
    controls: {
      blockPublicAccess: "PASS",
      bucketPolicy: "PASS",
      sseKms: "PASS",
      iamLeastPrivilege: "PASS",
      kmsKeyPolicy: "PASS",
      lifecycleBackstop: "PASS",
    },
  } as const;
}
