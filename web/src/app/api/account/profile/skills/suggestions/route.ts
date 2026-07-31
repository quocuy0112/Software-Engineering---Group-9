import {
  AccountRequestError,
  accountErrorResponse,
  accountJson,
  requireAccountRequest,
} from "@/backend/security/account-request-boundary";
import { SuggestProfileSkillsService } from "@/backend/services/profile/suggest-profile-skills";
import { skillSuggestionsQuerySchema } from "@/shared/contracts/account/profile";

export async function GET(request: Request): Promise<Response> {
  try {
    const current = await requireAccountRequest(request);
    const url = new URL(request.url);
    if (
      [...url.searchParams.keys()].some(
        (key) => key !== "query" && key !== "limit",
      )
    ) {
      throw new AccountRequestError(400, {
        code: "VALIDATION_ERROR",
        message: "Review the search parameters.",
      });
    }
    const query = skillSuggestionsQuerySchema.parse({
      query: url.searchParams.get("query") ?? "",
      limit: url.searchParams.get("limit") ?? undefined,
    });
    return accountJson(
      await new SuggestProfileSkillsService().execute(current.userId, query),
    );
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return accountErrorResponse(
        new AccountRequestError(400, {
          code: "VALIDATION_ERROR",
          message: "Review the search parameters.",
        }),
      );
    }
    return accountErrorResponse(error);
  }
}
