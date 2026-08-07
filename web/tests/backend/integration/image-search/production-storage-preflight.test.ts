import { describe, expect, it } from "vitest";

import {
  verifyProductionStoragePreflight,
  type ProductionStorageSnapshot,
} from "@/backend/image-search/storage/production-preflight";

const now = new Date("2026-08-06T09:00:00.000Z");
const expected = {
  bucket: "smarthire-private",
  prefix: "image-search/",
  kmsKeyId: "arn:aws:kms:ap-southeast-1:123456789012:key/fixture",
  workerRoleArn: "arn:aws:iam::123456789012:role/smarthire-image-search-worker",
};

function snapshot(
  overrides: Partial<ProductionStorageSnapshot> = {},
): ProductionStorageSnapshot {
  return {
    publicAccessBlock: {
      blockPublicAcls: true,
      ignorePublicAcls: true,
      blockPublicPolicy: true,
      restrictPublicBuckets: true,
    },
    bucketPolicyPublic: false,
    defaultEncryption: {
      algorithm: "aws:kms",
      kmsKeyId: expected.kmsKeyId,
      bucketKeyEnabled: true,
    },
    lifecycleRules: [
      {
        enabled: true,
        prefix: expected.prefix,
        expirationDays: 1,
        noncurrentExpirationDays: 1,
        abortIncompleteMultipartUploadDays: 1,
      },
    ],
    workerPolicy: {
      statements: [
        {
          effect: "Allow",
          actions: ["s3:ListBucket"],
          resources: [`arn:aws:s3:::${expected.bucket}`],
          prefixCondition: `${expected.prefix}*`,
        },
        {
          effect: "Allow",
          actions: [
            "s3:GetObject",
            "s3:PutObject",
            "s3:DeleteObject",
            "s3:AbortMultipartUpload",
          ],
          resources: [`arn:aws:s3:::${expected.bucket}/${expected.prefix}*`],
        },
        {
          effect: "Allow",
          actions: ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"],
          resources: [expected.kmsKeyId],
        },
      ],
    },
    kmsKeyPolicy: {
      keyId: expected.kmsKeyId,
      allowedPrincipalArns: [expected.workerRoleArn],
      allowedActions: ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"],
      publicPrincipal: false,
    },
    inspectedAt: now,
    ...overrides,
  };
}

describe("production image-search storage preflight", () => {
  it("emits a secret-free, 15-minute evidence report only when every live control passes", () => {
    const report = verifyProductionStoragePreflight(snapshot(), expected, now);
    expect(report).toMatchObject({
      schemaVersion: "image-search-storage-preflight-v1",
      status: "PASS",
      inspectedAt: now.toISOString(),
      validUntil: new Date(now.getTime() + 15 * 60_000).toISOString(),
      bucket: expected.bucket,
      prefix: expected.prefix,
      kmsKeyId: expected.kmsKeyId,
      workerRoleArn: expected.workerRoleArn,
    });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toMatch(
      /secret|accessKey|sessionToken|policyDocument|credential/iu,
    );
  });

  it.each([
    [
      "Block Public Access",
      () =>
        snapshot({
          publicAccessBlock: {
            ...snapshot().publicAccessBlock,
            blockPublicPolicy: false,
          },
        }),
      "S3_BLOCK_PUBLIC_ACCESS_REQUIRED",
    ],
    [
      "public policy status",
      () => snapshot({ bucketPolicyPublic: true }),
      "S3_PUBLIC_POLICY_FORBIDDEN",
    ],
    [
      "exact SSE-KMS key",
      () =>
        snapshot({
          defaultEncryption: {
            algorithm: "aws:kms",
            kmsKeyId: "wrong-key",
            bucketKeyEnabled: true,
          },
        }),
      "S3_SSE_KMS_POLICY_INVALID",
    ],
    [
      "least privilege",
      () =>
        snapshot({
          workerPolicy: {
            statements: [
              {
                effect: "Allow",
                actions: ["s3:*"],
                resources: ["*"],
              },
            ],
          },
        }),
      "IAM_LEAST_PRIVILEGE_POLICY_INVALID",
    ],
    [
      "KMS key policy",
      () =>
        snapshot({
          kmsKeyPolicy: {
            ...snapshot().kmsKeyPolicy,
            publicPrincipal: true,
          },
        }),
      "KMS_KEY_POLICY_INVALID",
    ],
    [
      "one-day lifecycle backstop",
      () =>
        snapshot({
          lifecycleRules: [
            {
              enabled: true,
              prefix: expected.prefix,
              expirationDays: 2,
              noncurrentExpirationDays: 1,
              abortIncompleteMultipartUploadDays: 1,
            },
          ],
        }),
      "S3_LIFECYCLE_BACKSTOP_INVALID",
    ],
  ])("fails closed when %s is invalid", (_name, fixture, code) => {
    expect(() =>
      verifyProductionStoragePreflight(fixture(), expected, now),
    ).toThrow(code);
  });

  it("rejects stale evidence instead of extending application retention", () => {
    expect(() =>
      verifyProductionStoragePreflight(
        snapshot({ inspectedAt: new Date(now.getTime() - 15 * 60_000 - 1) }),
        expected,
        now,
      ),
    ).toThrow("STORAGE_PREFLIGHT_SNAPSHOT_STALE");
  });
});
