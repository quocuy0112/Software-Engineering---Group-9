import { z } from "zod";

export const managedCompanyRoleSchema = z.enum(["HR_MANAGER", "RECRUITER"]);
export const teamInviteSchema = z.object({ email: z.string().email().max(320), role: managedCompanyRoleSchema }).strict();
export const teamMembershipCommandSchema = z.object({ action: z.enum(["role", "suspend", "restore", "remove"]), role: managedCompanyRoleSchema.optional() }).strict().superRefine((v, c) => { if (v.action === "role" && !v.role) c.addIssue({ code: "custom", message: "Role is required.", path: ["role"] }); if (v.action !== "role" && v.role) c.addIssue({ code: "custom", message: "Role is not allowed.", path: ["role"] }); });
export const teamAcceptSchema = z.object({ token: z.string().min(32).max(256) }).strict();
export const teamInvitationIdSchema = z.object({ invitationId: z.string().trim().min(1).max(128) }).strict();
export const teamInvitationReferenceSchema = z.union([
  teamAcceptSchema,
  teamInvitationIdSchema,
]);
export const teamInvitationPreviewSchema = teamInvitationReferenceSchema;
