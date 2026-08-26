import { z } from "zod";
import { discoverableProfileSchema } from "@/shared/contracts/profile-discovery";

const snapshotSchema = z.object({
  candidateName: z.string().min(1).max(120),
  headline: z.string().max(200).nullable(),
  summary: z.string().max(5_000).nullable(),
  location: z.string().max(160).nullable(),
  skills: z.array(z.string().min(1).max(80)).max(50),
  experience: z.array(z.object({ title: z.string().max(200), company: z.string().max(200) })).max(50),
  education: z.array(z.object({ institution: z.string().max(200), degree: z.string().max(200) })).max(50),
}).strict();

export const recruiterCandidateProfileSchema = z.object({
  submittedProfile: snapshotSchema.nullable(),
  liveProfile: discoverableProfileSchema.nullable(),
  contactShared: z.boolean(),
  submittedProfileAvailable: z.boolean(),
}).strict();

export type RecruiterCandidateProfile = z.infer<typeof recruiterCandidateProfileSchema>;
