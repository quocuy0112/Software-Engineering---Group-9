import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { EmployerVerificationPreparationService } from "@/backend/admin/verification/employer-verification-preparation-service";

const noStore = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  try {
    return adminJson(
      await new EmployerVerificationPreparationService().get(request),
      { headers: noStore },
    );
  } catch (error) {
    return adminRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    return adminJson(
      await new EmployerVerificationPreparationService().patch(
        request,
        await request.json(),
      ),
      { headers: noStore },
    );
  } catch (error) {
    return adminRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    return adminJson(
      await new EmployerVerificationPreparationService().reset(request),
      { headers: noStore },
    );
  } catch (error) {
    return adminRouteError(error);
  }
}
