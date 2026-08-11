import {
  adminJson,
  adminRouteError,
  AdminHttpError,
} from "@/backend/admin/http/admin-route";
import { ApplicantVerificationService } from "@/backend/admin/verification/applicant-verification-service";
export async function POST(
  request: Request,
  context: { params: Promise<{ requestId: string; action: string }> },
) {
  try {
    const { requestId, action } = await context.params;
    const service = new ApplicantVerificationService();
    if (action === "cancel")
      return adminJson(await service.cancel(request, requestId));
    if (action === "resubmit") {
      const size = Number(request.headers.get("content-length") ?? 0);
      if (size > 5_500_000) throw new AdminHttpError(413, "FILE_SIZE_INVALID");
      const form = await request.formData();
      const file = form.get("document");
      if (!(file instanceof File))
        throw new AdminHttpError(400, "VALIDATION_FAILED");
      return adminJson(await service.resubmit(request, requestId, file));
    }
    throw new AdminHttpError(404, "TARGET_UNAVAILABLE");
  } catch (error) {
    return adminRouteError(error);
  }
}
