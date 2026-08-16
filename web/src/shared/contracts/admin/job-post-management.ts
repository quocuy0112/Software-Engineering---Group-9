import { z } from "zod";
import { normalizedText } from "./common";

export const visibilityStateSchema = z.enum([
  "PUBLISHED",
  "HIDDEN",
  "ARCHIVED",
]);
export const applicationStateSchema = z.enum(["OPEN", "CLOSED"]);
const reason = normalizedText(1, 1000);
const confirmation = z.object({ confirmation: z.literal(true) });
const strictCommand = <Shape extends z.ZodRawShape>(shape: Shape) =>
  confirmation.extend(shape).strict();

export const jobManagementCommandSchema = z.discriminatedUnion("command", [
  strictCommand({ command: z.literal("HIDE"), reason }),
  strictCommand({ command: z.literal("RESTORE"), reason }),
  strictCommand({ command: z.literal("CLOSE_APPLICATIONS"), reason }),
  strictCommand({ command: z.literal("REOPEN_APPLICATIONS"), reason }),
  strictCommand({ command: z.literal("ARCHIVE"), reason }),
  strictCommand({ command: z.literal("SOFT_DELETE"), reason }),
  strictCommand({
    command: z.literal("REQUEST_CHANGES"),
    publicExplanation: normalizedText(20, 1000),
    hideImmediately: z.boolean(),
  }),
  strictCommand({
    command: z.literal("FEATURE"),
    placement: z.enum(["HOME_FEATURED", "SEARCH_FEATURED"]),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    priority: z.number().int().min(1).max(100),
    reason,
  }),
  strictCommand({
    command: z.literal("AMEND_FEATURE"),
    featureId: z.string().min(1).max(128),
    placement: z.enum(["HOME_FEATURED", "SEARCH_FEATURED"]),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    priority: z.number().int().min(1).max(100),
    reason,
  }),
  strictCommand({
    command: z.literal("UNFEATURE"),
    featureId: z.string().min(1).max(128),
    reason,
  }),
  strictCommand({
    command: z.literal("ENFORCE"),
    type: z.enum([
      "HIDE_JOB",
      "CLOSE_APPLICATIONS",
      "REQUEST_CHANGES",
      "SOFT_DELETE_JOB",
    ]),
    reportIds: z.array(z.string().min(1).max(128)).min(1).max(100),
    reason,
    publicExplanation: normalizedText(0, 1000).optional(),
  }).superRefine((value, context) => {
    if (
      value.type === "REQUEST_CHANGES" &&
      (value.publicExplanation?.length ?? 0) < 20
    )
      context.addIssue({
        code: "custom",
        path: ["publicExplanation"],
        message: "REQUEST_CHANGES requires 20-1,000 characters",
      });
  }),
]);

export type JobManagementCommand = z.infer<typeof jobManagementCommandSchema>;

export const jobManagementListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().min(1).max(200).optional(),
  visibility: visibilityStateSchema.optional(),
  applicationState: applicationStateSchema.optional(),
  featured: z.coerce.boolean().optional(),
  reportState: z.enum(["ANY", "REPORTED", "UNREPORTED"]).optional(),
  minimumReports: z.coerce.number().int().min(1).max(100000).optional(),
  companyId: z.string().min(1).max(128).optional(),
  recruiterId: z.string().min(1).max(128).optional(),
  approverId: z.string().min(1).max(128).optional(),
  approvedFrom: z.coerce.date().optional(),
  approvedTo: z.coerce.date().optional(),
  publishedFrom: z.coerce.date().optional(),
  publishedTo: z.coerce.date().optional(),
});
