import { z } from "zod";
import {
  appliedJobStateSchema,
  jobPreferencesUpdateSchema,
  userJobStateViewSchema,
} from "@/shared/contracts/jobs/catalog";
import {
  parseBoundedJson,
  jobErrorResponse,
  jobJson,
  requireJobActor,
} from "@/backend/security/job-request-boundary";
import {
  projectUserJobState,
  readUserJobState,
  updateUserJobState,
  userJobStateFileEnabled,
  type UserJobStateMutation,
} from "@/backend/services/jobs/user-job-state-store";

const mutationSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("save"),
      jobId: z.string().min(1).max(128),
    })
    .strict(),
  z
    .object({
      action: z.literal("unsave"),
      jobId: z.string().min(1).max(128),
    })
    .strict(),
  z
    .object({
      action: z.literal("hide"),
      jobId: z.string().min(1).max(128),
    })
    .strict(),
  z
    .object({
      action: z.literal("unhide"),
      jobId: z.string().min(1).max(128),
    })
    .strict(),
  z
    .object({
      action: z.literal("update-preferences"),
      jobPreferences: jobPreferencesUpdateSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("apply"),
      jobId: z.string().min(1).max(128),
      appliedJob: appliedJobStateSchema,
    })
    .strict(),
]);

function unavailable() {
  return jobJson(
    {
      code: "JOB_STATE_UNAVAILABLE",
      message: "The local job-state mirror is not enabled.",
    },
    { status: 404 },
  );
}

export async function GET(request: Request) {
  if (!userJobStateFileEnabled()) return unavailable();
  try {
    await requireJobActor(request, { mutation: false });
    return jobJson(
      userJobStateViewSchema.parse(
        projectUserJobState(await readUserJobState()),
      ),
    );
  } catch (error) {
    return jobErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  if (!userJobStateFileEnabled()) return unavailable();
  try {
    await requireJobActor(request);
    const mutation = (await parseBoundedJson(
      request,
      mutationSchema,
      64 * 1024,
    )) as UserJobStateMutation;
    const state = await updateUserJobState(mutation);
    return jobJson(userJobStateViewSchema.parse(projectUserJobState(state)));
  } catch (error) {
    return jobErrorResponse(error);
  }
}
