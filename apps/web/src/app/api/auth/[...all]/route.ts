/**
 * SmartHire owns every public identity endpoint under `/api/identity/**`.
 * Better Auth remains an internal credential/session provider, so exposing its
 * generic HTTP surface here would let callers bypass SmartHire rate limits,
 * audit events, account-state checks, and transactional registration workflow.
 */
function providerRouteNotFound(request: Request) {
  void request;
  return Response.json(
    { message: "Not found." },
    {
      status: 404,
      headers: {
        "cache-control": "no-store",
        pragma: "no-cache",
      },
    },
  );
}

export const GET = providerRouteNotFound;
export const POST = providerRouteNotFound;
