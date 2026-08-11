import "server-only";
import { isAbsolute } from "node:path";
import { z } from "zod";

const bool = z.enum(["true", "false"]).transform((value) => value === "true");
const base64Key = z.string().refine((value) => {
  try {
    return Buffer.from(value, "base64").byteLength === 32;
  } catch {
    return false;
  }
}, "must decode to 32 bytes");

const schema = z
  .object({
    APP_ENV: z.enum(["local", "test", "production"]).default("local"),
    ADMIN_ORIGIN: z
      .string()
      .url()
      .default("http://console.admin.localhost:3001"),
    RECRUITER_ORIGIN: z
      .string()
      .url()
      .default("http://console.recruiter.localhost:3001"),
    CANDIDATE_ORIGIN: z.string().url().default("http://localhost:3001"),
    ADMIN_WORKER_ENABLED: bool.default(false),
    ADMIN_EVIDENCE_STORAGE_ADAPTER: z
      .enum(["filesystem", "s3"])
      .default("filesystem"),
    ADMIN_EVIDENCE_STORAGE_ROOT: z
      .string()
      .default("D:/smarthire/admin-evidence"),
    ADMIN_EVIDENCE_KEY_V1: base64Key.optional(),
    ADMIN_EVIDENCE_KEY_VERSION: z.coerce.number().int().positive().default(1),
    ADMIN_EVIDENCE_S3_BUCKET: z.string().min(1).optional(),
    ADMIN_EVIDENCE_S3_REGION: z.string().min(1).optional(),
    ADMIN_EVIDENCE_S3_KMS_KEY_ID: z.string().min(1).optional(),
    ADMIN_CLAMD_SOCKET_PATH: z
      .literal("/run/clamav/clamd.sock")
      .default("/run/clamav/clamd.sock"),
    ADMIN_NOTIFICATION_ENABLED: bool.default(true),
    ADMIN_EVIDENCE_POLICY_VERSION: z
      .literal("business-license-evidence-v1")
      .optional(),
    ADMIN_EVIDENCE_LEGAL_APPROVER: z.string().min(3).optional(),
    ADMIN_EVIDENCE_LEGAL_APPROVED: bool.optional(),
    ADMIN_EVIDENCE_SECURITY_APPROVER: z.string().min(3).optional(),
    ADMIN_EVIDENCE_SECURITY_APPROVED: bool.optional(),
    ADMIN_EVIDENCE_OPERATIONS_APPROVER: z.string().min(3).optional(),
    ADMIN_EVIDENCE_OPERATIONS_APPROVED: bool.optional(),
    ADMIN_COMPANY_PREREQUISITE_OWNER: z.string().min(1).optional(),
    ADMIN_COMPANY_PREREQUISITE_VERSION: z.string().min(1).optional(),
    ADMIN_COMPANY_PREREQUISITE_READY: bool.default(false),
    ADMIN_EVIDENCE_TERMINAL_DELETE_HOURS: z.coerce
      .number()
      .int()
      .positive()
      .default(24),
    ADMIN_EVIDENCE_INACTIVE_APPROVAL_DELETE_DAYS: z.coerce
      .number()
      .int()
      .positive()
      .default(30),
    ADMIN_SNAPSHOT_INTERVAL_SECONDS: z.coerce
      .number()
      .int()
      .min(10)
      .max(60)
      .default(30),
  })
  .superRefine((value, context) => {
    const origins = [
      value.CANDIDATE_ORIGIN,
      value.ADMIN_ORIGIN,
      value.RECRUITER_ORIGIN,
    ].map((entry) => new URL(entry));
    if (new Set(origins.map((entry) => entry.origin)).size !== origins.length) {
      context.addIssue({
        code: "custom",
        path: ["ADMIN_ORIGIN"],
        message: "candidate, admin, and recruiter origins must be distinct",
      });
    }
    if (value.ADMIN_EVIDENCE_STORAGE_ADAPTER === "filesystem") {
      if (!isAbsolute(value.ADMIN_EVIDENCE_STORAGE_ROOT)) {
        context.addIssue({
          code: "custom",
          path: ["ADMIN_EVIDENCE_STORAGE_ROOT"],
          message: "filesystem evidence storage requires an absolute path",
        });
      }
      if (value.APP_ENV === "production") {
        context.addIssue({
          code: "custom",
          path: ["ADMIN_EVIDENCE_STORAGE_ADAPTER"],
          message: "production requires private S3 evidence storage",
        });
      }
    }
    if (value.APP_ENV === "production") {
      for (const origin of origins) {
        if (origin.protocol !== "https:" || origin.hostname.includes("*")) {
          context.addIssue({
            code: "custom",
            path: ["ADMIN_ORIGIN"],
            message: "production origins must be exact HTTPS origins",
          });
        }
      }
      if (
        !value.ADMIN_EVIDENCE_S3_BUCKET ||
        !value.ADMIN_EVIDENCE_S3_REGION ||
        !value.ADMIN_EVIDENCE_S3_KMS_KEY_ID
      ) {
        context.addIssue({
          code: "custom",
          path: ["ADMIN_EVIDENCE_S3_BUCKET"],
          message: "production evidence S3 configuration is incomplete",
        });
      }
      if (
        value.ADMIN_EVIDENCE_POLICY_VERSION !== "business-license-evidence-v1"
      ) {
        context.addIssue({
          code: "custom",
          path: ["ADMIN_EVIDENCE_POLICY_VERSION"],
          message: "production requires the approved evidence policy version",
        });
      }
      if (
        !value.ADMIN_WORKER_ENABLED ||
        !value.ADMIN_NOTIFICATION_ENABLED ||
        value.ADMIN_EVIDENCE_TERMINAL_DELETE_HOURS !== 24 ||
        value.ADMIN_EVIDENCE_INACTIVE_APPROVAL_DELETE_DAYS !== 30
      ) {
        context.addIssue({
          code: "custom",
          path: ["ADMIN_WORKER_ENABLED"],
          message:
            "production requires worker, notifications, and exact evidence deadlines",
        });
      }
      for (const approval of [
        [
          value.ADMIN_EVIDENCE_LEGAL_APPROVER,
          value.ADMIN_EVIDENCE_LEGAL_APPROVED,
        ],
        [
          value.ADMIN_EVIDENCE_SECURITY_APPROVER,
          value.ADMIN_EVIDENCE_SECURITY_APPROVED,
        ],
        [
          value.ADMIN_EVIDENCE_OPERATIONS_APPROVER,
          value.ADMIN_EVIDENCE_OPERATIONS_APPROVED,
        ],
      ] as const) {
        if (!approval[0] || approval[1] !== true) {
          context.addIssue({
            code: "custom",
            path: ["ADMIN_EVIDENCE_POLICY_VERSION"],
            message:
              "production requires named Legal, Security, and Operations approvals",
          });
          break;
        }
      }
    }
  });

export type AdminConfiguration = Readonly<z.infer<typeof schema>>;

export function loadAdminConfiguration(
  input: NodeJS.ProcessEnv | Record<string, string | undefined>,
): AdminConfiguration {
  const parsed = schema.parse(input);
  return Object.freeze({
    ...parsed,
    ADMIN_ORIGIN: new URL(parsed.ADMIN_ORIGIN).origin,
    RECRUITER_ORIGIN: new URL(parsed.RECRUITER_ORIGIN).origin,
    CANDIDATE_ORIGIN: new URL(parsed.CANDIDATE_ORIGIN).origin,
  });
}
