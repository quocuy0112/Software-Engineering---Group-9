import { BackupService } from "../src/backend/backup/backup-service.ts";

const service = new BackupService();
await service.request("MANUAL", "backup-smoke", `drive-smoke-${Date.now()}`);
console.log(JSON.stringify(await service.runDue(), null, 2));
