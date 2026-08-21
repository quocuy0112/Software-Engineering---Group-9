import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { BackupService } from "@/backend/backup/backup-service";
export async function GET(request: Request) { try { await new AdminRequestBoundary().require(request, { sensitive: true }); return adminJson(await new BackupService().history()); } catch (error) { return adminRouteError(error); } }
export async function POST(request: Request) { try { const admin = await new AdminRequestBoundary().require(request, { sensitive: true }); return adminJson(await new BackupService().request("MANUAL", admin.userId, request.headers.get("idempotency-key") ?? undefined), { status: 202 }); } catch (error) { return adminRouteError(error); } }
