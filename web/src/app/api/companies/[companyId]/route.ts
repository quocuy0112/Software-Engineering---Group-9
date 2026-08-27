import {
  accountErrorResponse,
  accountJson,
  requireAccountRequest,
} from "@/backend/security/account-request-boundary";
import { CompanyDiscoveryService } from "@/backend/services/companies/company-discovery-service";
import { CompanyDiscoveryAuthorizationError } from "@/backend/services/companies/company-discovery-authorization";

export async function GET(
  request: Request,
  context: { params: Promise<{ companyId: string }> },
) {
  try {
    const account = await requireAccountRequest(request);
    const { companyId } = await context.params;
    return accountJson(
      await new CompanyDiscoveryService().detail(
        companyId,
        { kind: "user", userId: account.userId, sessionId: account.sessionId },
        {},
      ),
    );
  } catch (error) {
    if (error instanceof CompanyDiscoveryAuthorizationError) {
      return accountJson(
        {
          code: "COMPANY_UNAVAILABLE",
          message: "This company is not available.",
        },
        { status: 404 },
      );
    }
    return accountErrorResponse(error);
  }
}
