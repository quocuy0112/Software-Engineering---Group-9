import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const schema = await readFile(resolve(root, "prisma/schema.prisma"), "utf8");
const threadMigration = await readFile(resolve(root, "prisma/migrations/055_recruitment_messaging/migration.sql"), "utf8");
const reportMigration = await readFile(resolve(root, "prisma/migrations/056_recruitment_messaging_reports/migration.sql"), "utf8");
const required = ["model RecruitmentThread", "model RecruitmentMessage", "recruitmentThreadId", "recruitmentEvidenceMessageId"];
if (!required.every((token) => schema.includes(token)) || !threadMigration.includes('CREATE TABLE "RecruitmentThread"') || !reportMigration.includes('ALTER COLUMN "conversationId" DROP NOT NULL')) {
  throw new Error("RECRUITMENT_MESSAGING_MIGRATION_INVALID");
}
console.log(JSON.stringify({ pass: true, migrations: ["055_recruitment_messaging", "056_recruitment_messaging_reports"] }));
