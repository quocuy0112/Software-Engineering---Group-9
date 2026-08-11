import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { ApplicantVerificationService } from "@/backend/admin/verification/applicant-verification-service";

export async function GET(request: Request) {
  try {
    return adminJson({
      data: await new ApplicantVerificationService().list(request),
    });
  } catch (error) {
    return adminRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const size = Number(request.headers.get("content-length") ?? 0);
    if (size > 5_500_000)
      return adminJson({ code: "FILE_SIZE_INVALID" }, { status: 413 });
    const form = await request.formData();
    const file = form.get("document");
    if (!(file instanceof File))
      return adminJson({ code: "VALIDATION_FAILED" }, { status: 400 });
    const raw = {
      companyName: form.get("companyName"),
      taxIdentifier: form.get("taxIdentifier"),
      requestedRole: form.get("requestedRole"),
      targetCompanyId: form.get("targetCompanyId") || undefined,
      prerequisiteId: form.get("prerequisiteId") || undefined,
    };
    return adminJson(
      await new ApplicantVerificationService().submit(request, raw, file),
      { status: 202 },
    );
  } catch (error) {
    return adminRouteError(error);
  }
}
