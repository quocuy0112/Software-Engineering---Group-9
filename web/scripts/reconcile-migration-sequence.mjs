import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

const renames = [
  ["052_recruitment_analytics_export", "053_recruitment_analytics_export"],
  ["053_company_invitation_delivery", "054_company_invitation_delivery"],
  ["054_company_invitation_decision_activity", "055_company_invitation_decision_activity"],
  ["055_recruitment_messaging", "056_recruitment_messaging"],
  ["056_recruitment_messaging_reports", "057_recruitment_messaging_reports"],
  ["057_company_ban_lifecycle", "058_company_ban_lifecycle"],
  ["058_company_ban_notifications", "059_company_ban_notifications"],
  ["20260820163010", "060_company_invitation_email_state_index"],
  ["20260821183000_admin_data_backup", "061_admin_data_backup"],
  ["20260821190000_admin_backup_drive_folder", "062_admin_backup_drive_folder"],
];

const { prisma } = await import("../src/backend/database/prisma.ts");

try {
  let reconciled = 0;
  await prisma.$transaction(async (tx) => {
    for (const [previous, next] of renames) {
      const alreadyRenamed = await tx.$queryRaw`
        SELECT 1 FROM "_prisma_migrations" WHERE migration_name = ${next} LIMIT 1
      `;
      if (alreadyRenamed.length > 0) continue;
      const result = await tx.$executeRaw`
        UPDATE "_prisma_migrations"
        SET migration_name = ${next}
        WHERE migration_name = ${previous}
      `;
      reconciled += result;
    }
  });
  console.log(JSON.stringify({ reconciled, pass: true }, null, 2));
} finally {
  await prisma.$disconnect();
}
