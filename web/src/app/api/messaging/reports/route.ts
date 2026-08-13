import { z } from "zod";
import { MessagingRequestBoundary } from "@/backend/messaging/authorization/messaging-request-boundary";
import { MessagingError } from "@/backend/messaging/messaging-errors";
import {
  messagingJson,
  messagingRouteError,
  parseMessagingJson,
} from "@/backend/messaging/http/messaging-route";
import { ReportMessagingService } from "@/backend/messaging/services/report-messaging";
import { admitMessagingRequest } from "@/backend/messaging/services/messaging-rate-limit";
import {
  messagingReportInputSchema,
  reportReceiptSchema,
} from "@/shared/contracts/messaging/safety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const actor = await new MessagingRequestBoundary().requireHttp(request);
    if (!z.uuid().safeParse(request.headers.get("idempotency-key")).success) {
      throw new MessagingError("VALIDATION_ERROR", 400);
    }
    await admitMessagingRequest("messagingReport", actor.userId);
    const input = await parseMessagingJson(request, messagingReportInputSchema);
    const receipt = await new ReportMessagingService().execute(actor, input);
    return messagingJson(reportReceiptSchema.parse(receipt), { status: 202 });
  } catch (error) {
    return messagingRouteError(error);
  }
}
