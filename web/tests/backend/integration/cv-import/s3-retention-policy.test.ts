import { describe, expect, it } from "vitest";

import { S3PrivateCvStorage } from "@/backend/cv/storage/s3";

type PolicyFixture = Readonly<{
  publicAccess: Readonly<{
    BlockPublicAcls?: boolean;
    IgnorePublicAcls?: boolean;
    BlockPublicPolicy?: boolean;
    RestrictPublicBuckets?: boolean;
  }>;
  policyPublic: boolean | undefined;
  versioningStatus?: string;
  encryption: Readonly<{
    algorithm?: string;
    kmsKeyId?: string;
    bucketKeyEnabled?: boolean;
  }>;
  lifecycle: ReadonlyArray<
    Readonly<{
      status?: string;
      prefix?: string;
      expirationDays?: number;
      abortDays?: number;
      noncurrentExpiration?: unknown;
      noncurrentTransitions?: unknown;
    }>
  >;
}>;

const safePolicy: PolicyFixture = Object.freeze({
  publicAccess: Object.freeze({
    BlockPublicAcls: true,
    IgnorePublicAcls: true,
    BlockPublicPolicy: true,
    RestrictPublicBuckets: true,
  }),
  policyPublic: false,
  encryption: Object.freeze({
    algorithm: "aws:kms",
    kmsKeyId: "fixture-kms-key",
    bucketKeyEnabled: true,
  }),
  lifecycle: Object.freeze([
    Object.freeze({
      status: "Enabled",
      prefix: "cv-artifacts/",
      expirationDays: 31,
      abortDays: 1,
    }),
  ]),
});

class PolicyS3Client {
  readonly commands: string[] = [];

  constructor(private readonly fixture: PolicyFixture) {}

  async send(command: never): Promise<unknown> {
    const name = (command as { constructor: { name: string } }).constructor
      .name;
    this.commands.push(name);
    if (name === "GetPublicAccessBlockCommand") {
      return { PublicAccessBlockConfiguration: this.fixture.publicAccess };
    }
    if (name === "GetBucketPolicyStatusCommand") {
      return { PolicyStatus: { IsPublic: this.fixture.policyPublic } };
    }
    if (name === "GetBucketVersioningCommand") {
      return this.fixture.versioningStatus
        ? { Status: this.fixture.versioningStatus }
        : {};
    }
    if (name === "GetBucketEncryptionCommand") {
      return {
        ServerSideEncryptionConfiguration: {
          Rules: [
            {
              ApplyServerSideEncryptionByDefault: {
                SSEAlgorithm: this.fixture.encryption.algorithm,
                KMSMasterKeyID: this.fixture.encryption.kmsKeyId,
              },
              BucketKeyEnabled: this.fixture.encryption.bucketKeyEnabled,
            },
          ],
        },
      };
    }
    if (name === "GetBucketLifecycleConfigurationCommand") {
      return {
        Rules: this.fixture.lifecycle.map((rule) => ({
          Status: rule.status,
          Filter: { Prefix: rule.prefix },
          Expiration: { Days: rule.expirationDays },
          AbortIncompleteMultipartUpload: {
            DaysAfterInitiation: rule.abortDays,
          },
          ...(rule.noncurrentExpiration === undefined
            ? {}
            : { NoncurrentVersionExpiration: rule.noncurrentExpiration }),
          ...(rule.noncurrentTransitions === undefined
            ? {}
            : { NoncurrentVersionTransitions: rule.noncurrentTransitions }),
        })),
      };
    }
    throw new Error(`unexpected command ${name}`);
  }
}

function withPolicy(
  changes: Partial<PolicyFixture> & {
    encryption?: Partial<PolicyFixture["encryption"]>;
    publicAccess?: Partial<PolicyFixture["publicAccess"]>;
  } = {},
): PolicyFixture {
  return {
    ...safePolicy,
    ...changes,
    publicAccess: { ...safePolicy.publicAccess, ...changes.publicAccess },
    encryption: { ...safePolicy.encryption, ...changes.encryption },
  };
}

function storage(fixture: PolicyFixture): {
  adapter: S3PrivateCvStorage;
  client: PolicyS3Client;
} {
  const client = new PolicyS3Client(fixture);
  return {
    client,
    adapter: new S3PrivateCvStorage({
      client,
      bucket: "fixture-private-bucket",
      region: "fixture-region-1",
      kmsKeyId: "fixture-kms-key",
      prefix: "cv-artifacts",
    }),
  };
}

describe("production S3 retention policy gate", () => {
  it("accepts only a private, non-versioned, SSE-KMS bucket with bounded lifecycle safeguards", async () => {
    const { adapter, client } = storage(safePolicy);
    await expect(adapter.assertReady()).resolves.toBeUndefined();
    expect(client.commands).toEqual([
      "GetPublicAccessBlockCommand",
      "GetBucketPolicyStatusCommand",
      "GetBucketVersioningCommand",
      "GetBucketEncryptionCommand",
      "GetBucketLifecycleConfigurationCommand",
    ]);
  });

  it.each([
    [
      "public ACLs are not blocked",
      withPolicy({ publicAccess: { BlockPublicAcls: false } }),
    ],
    ["the bucket policy is public", withPolicy({ policyPublic: true })],
    [
      "bucket policy status is unavailable",
      withPolicy({ policyPublic: undefined }),
    ],
    ["versioning is enabled", withPolicy({ versioningStatus: "Enabled" })],
    ["versioning is suspended", withPolicy({ versioningStatus: "Suspended" })],
    ["SSE-KMS is absent", withPolicy({ encryption: { algorithm: "AES256" } })],
    [
      "the KMS key differs",
      withPolicy({ encryption: { kmsKeyId: "other-key" } }),
    ],
    [
      "S3 bucket keys are disabled",
      withPolicy({ encryption: { bucketKeyEnabled: false } }),
    ],
    [
      "the lifecycle rule is disabled",
      withPolicy({
        lifecycle: [{ ...safePolicy.lifecycle[0]!, status: "Disabled" }],
      }),
    ],
    [
      "the lifecycle prefix differs",
      withPolicy({
        lifecycle: [{ ...safePolicy.lifecycle[0]!, prefix: "other/" }],
      }),
    ],
    [
      "object expiration exceeds 31 days",
      withPolicy({
        lifecycle: [{ ...safePolicy.lifecycle[0]!, expirationDays: 32 }],
      }),
    ],
    [
      "object expiration is invalid",
      withPolicy({
        lifecycle: [{ ...safePolicy.lifecycle[0]!, expirationDays: 0 }],
      }),
    ],
    [
      "multipart uploads survive beyond one day",
      withPolicy({
        lifecycle: [{ ...safePolicy.lifecycle[0]!, abortDays: 2 }],
      }),
    ],
    [
      "noncurrent source/extracted versions are retained",
      withPolicy({
        lifecycle: [
          {
            ...safePolicy.lifecycle[0]!,
            noncurrentExpiration: { NoncurrentDays: 1 },
          },
        ],
      }),
    ],
    [
      "noncurrent source/extracted versions are transitioned",
      withPolicy({
        lifecycle: [
          {
            ...safePolicy.lifecycle[0]!,
            noncurrentTransitions: [{ NoncurrentDays: 1 }],
          },
        ],
      }),
    ],
  ])("rejects unsafe deployment policy when %s", async (_label, fixture) => {
    const { adapter } = storage(fixture);
    await expect(adapter.assertReady()).rejects.toMatchObject({
      code: "CV_STORAGE_NOT_READY",
    });
  });
});
