import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { VerificationApprovalTransaction } from "@/backend/admin/verification/verification-approval-transaction";
import { readVerificationCommand } from "@/backend/admin/verification/verification-command-http";
export async function POST(
  request: Request,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const authority = await new AdminRequestBoundary().require(request, {
      sensitive: true,
    });
    return adminJson(
      await new VerificationApprovalTransaction().execute(
        authority,
        (await context.params).requestId,
        (await readVerificationCommand(request, "approve")) as never,
      ),
    );
  } catch (error) {
    return adminRouteError(error);
  }
}
