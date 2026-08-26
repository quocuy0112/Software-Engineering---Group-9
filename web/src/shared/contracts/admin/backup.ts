import { z } from "zod";

export const backupSettingsSchema = z.object({
  enabled: z.boolean(),
  intervalSeconds: z.number().int().min(10).max(86_400),
});

export type BackupSettings = z.infer<typeof backupSettingsSchema>;
