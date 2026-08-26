import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { VerificationApprovalTransaction } from "@/backend/admin/verification/verification-approval-transaction";
import { readVerificationCommand } from "@/backend/admin/verification/verification-command-http";
import { syncRecruiterCompanyToCatalogue } from "@/backend/services/jobs/recruiter-job-posting-data";
export async function POST(
  request: Request,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const authority = await new AdminRequestBoundary().require(request, {
      sensitive: true,
    });
    const result = await new VerificationApprovalTransaction().execute(
      authority,
      (await context.params).requestId,
      (await readVerificationCommand(request, "approve")) as never,
    );
    if (result && typeof result.companyId === "string") {
      try {
        await syncRecruiterCompanyToCatalogue(result.companyId);
      } catch (error) {
        // Approval is already committed in PostgreSQL. A catalogue writer may
        // be temporarily unavailable, but the DB-backed recruiter view remains
        // authoritative and will expose the new Owner membership.
        console.error(
          "[verification] recruiter company catalogue sync failed",
          {
            companyId: result.companyId,
            error,
          },
        );
      }
    }
    return adminJson(result);
  } catch (error) {
    return adminRouteError(error);
  }
}
