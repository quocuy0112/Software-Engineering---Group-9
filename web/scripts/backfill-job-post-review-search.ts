import { prisma } from "@/backend/database/prisma";
import { normalizedReviewTitleSearch } from "@/backend/jobs/review/job-post-review-search";

function titleFromSnapshot(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot))
    return "";
  const title = (snapshot as Record<string, unknown>).title;
  return typeof title === "string" ? title : "";
}

async function main() {
  let cursor: string | undefined;
  let updated = 0;
  for (;;) {
    const rows = await prisma.jobPostReviewVersion.findMany({
      select: { id: true, snapshot: true, normalizedTitleSearch: true },
      orderBy: { id: "asc" },
      take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!rows.length) break;
    for (const row of rows) {
      const normalizedTitleSearch = normalizedReviewTitleSearch(
        titleFromSnapshot(row.snapshot),
      );
      if (row.normalizedTitleSearch === normalizedTitleSearch) continue;
      await prisma.jobPostReviewVersion.update({
        where: { id: row.id },
        data: { normalizedTitleSearch },
      });
      updated += 1;
    }
    cursor = rows.at(-1)?.id;
  }
  console.log(`Backfilled ${updated} job-post review search titles.`);
}

void main().finally(() => prisma.$disconnect());
