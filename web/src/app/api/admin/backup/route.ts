import { z } from "zod";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { adminJson, adminRouteError, parseAdminJson } from "@/backend/admin/http/admin-route";
import { BackupService } from "@/backend/backup/backup-service";

const input = z.object({ enabled: z.boolean(), intervalSeconds: z.number().int().min(10).max(86_400) });
export async function GET(request: Request) { try { await new AdminRequestBoundary().require(request, { sensitive: true }); return adminJson(await new BackupService().settings()); } catch (error) { return adminRouteError(error); } }
export async function PUT(request: Request) { try { const admin = await new AdminRequestBoundary().require(request, { sensitive: true }); return adminJson(await new BackupService().update({ ...(await parseAdminJson(request, input)), actorId: admin.userId })); } catch (error) { return adminRouteError(error); } }
