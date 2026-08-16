import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireSession } from "@/backend/auth/session/require-session";
import {
  closeRecruiterJob,
  createRecruiterJob,
  readRecruiterJobManagementData,
  updateRecruiterJob,
} from "@/backend/services/jobs/recruiter-job-posting-data";

const noStore = { "Cache-Control": "no-store" };

function errorResponse(
  message: string,
  status = 400,
  fieldErrors?: Record<string, string>,
) {
  return NextResponse.json(
    fieldErrors ? { message, fieldErrors } : { message },
    { status, headers: noStore },
  );
}

async function actor(request: Request) {
  return requireSession(request.headers);
}

function mutationErrorResponse(error: unknown, fallback: string) {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const path = issue.path.join(".");
      if (path && !fieldErrors[path]) {
        fieldErrors[path] = "Review this field and try again.";
      }
    }
    return errorResponse(
      "Review the highlighted fields before saving this posting.",
      422,
      fieldErrors,
    );
  }

  if (error instanceof SyntaxError) {
    return errorResponse("Request body must be valid JSON.", 400);
  }

  const message = error instanceof Error ? error.message : fallback;
  if (message === "Company profile is incomplete.") {
    return errorResponse(message, 409);
  }
  if (message === "A recruiter-owned company is required.") {
    return errorResponse(message, 409);
  }
  if (message === "Job posting not found.") {
    return errorResponse(message, 404);
  }
  if (
    message === "This job posting cannot be edited in its current status." ||
    message === "This job posting cannot be closed in its current status." ||
    message === "This job posting is locked while review is pending."
  ) {
    return errorResponse(message, 409);
  }
  return errorResponse(message, 400);
}

export async function GET(request: Request) {
  const current = await actor(request);
  if (!current) return errorResponse("Authentication required.", 401);
  try {
    return NextResponse.json(
      await readRecruiterJobManagementData(current.userId),
      { headers: noStore },
    );
  } catch {
    return errorResponse("Unable to load job postings.", 503);
  }
}

export async function POST(request: Request) {
  const current = await actor(request);
  if (!current) return errorResponse("Authentication required.", 401);
  try {
    const body = (await request.json()) as { status?: unknown; job?: unknown };
    if (body.status !== "draft") {
      return errorResponse("Only draft content can be saved here.", 422, {
        status: "Use the review submission action after saving the draft.",
      });
    }
    const job = await createRecruiterJob(current.userId, body.job, body.status);
    return NextResponse.json(job, { status: 201, headers: noStore });
  } catch (error) {
    return mutationErrorResponse(error, "Unable to create job posting.");
  }
}

export async function PATCH(request: Request) {
  const current = await actor(request);
  if (!current) return errorResponse("Authentication required.", 401);
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (body.status !== "draft" && body.status !== "rejected")
      return errorResponse("Only draft content can be saved here.", 422);
    const job = await updateRecruiterJob(current.userId, {
      ...body,
      status: "draft",
    });
    return NextResponse.json(job, { headers: noStore });
  } catch (error) {
    return mutationErrorResponse(error, "Unable to update job posting.");
  }
}

export async function DELETE(request: Request) {
  const current = await actor(request);
  if (!current) return errorResponse("Authentication required.", 401);
  try {
    const jobId = new URL(request.url).searchParams.get("jobId");
    if (!jobId) return errorResponse("A job id is required.");
    const job = await closeRecruiterJob(current.userId, jobId);
    return NextResponse.json(job, { headers: noStore });
  } catch (error) {
    return mutationErrorResponse(error, "Unable to close job posting.");
  }
}
