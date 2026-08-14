import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { EmployerVerificationPreparationService } from "@/backend/admin/verification/employer-verification-preparation-service";

export async function POST(request: Request) {
  try {
    return adminJson(
      await new EmployerVerificationPreparationService().issueEmailChallenge(
        request,
        await request.json(),
      ),
      {
        status: 202,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    return adminRouteError(error);
  }
}
