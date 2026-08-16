import { z } from "zod";
import { normalizedText } from "./common";

export const visibilityStateSchema = z.enum(["PUBLISHED", "HIDDEN", "ARCHIVED"]);
export const applicationStateSchema = z.enum(["OPEN", "CLOSED"]);
const reason = normalizedText(1, 1000);
const confirmation = z.object({ confirmation: z.literal(true) });

export const jobManagementCommandSchema = z.discriminatedUnion("command", [
  confirmation.extend({ command: z.literal("HIDE"), reason }),
  confirmation.extend({ command: z.literal("RESTORE"), reason }),
  confirmation.extend({ command: z.literal("CLOSE_APPLICATIONS"), reason }),
  confirmation.extend({ command: z.literal("REOPEN_APPLICATIONS"), reason }),
  confirmation.extend({ command: z.literal("ARCHIVE"), reason }),
  confirmation.extend({ command: z.literal("SOFT_DELETE"), reason }),
  confirmation.extend({
    command: z.literal("REQUEST_CHANGES"),
    publicExplanation: normalizedText(20, 1000),
    hideImmediately: z.boolean(),
  }),
  confirmation.extend({
    command: z.literal("FEATURE"),
    placement: z.enum(["HOME_FEATURED", "SEARCH_FEATURED"]),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    priority: z.number().int().min(1).max(100),
    reason,
  }),
  confirmation.extend({
    command: z.literal("UNFEATURE"),
    featureId: z.string().min(1).max(128),
    reason,
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
  minimumReports: z.coerce.number().int().min(1).max(100000).optional(),
});
