import "server-only";
import { BackupService } from "@/backend/backup/backup-service";
export const runBackupScheduleCycle = (now = new Date()) => new BackupService().runDue(now);
