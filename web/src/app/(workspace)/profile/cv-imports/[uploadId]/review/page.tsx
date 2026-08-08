import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { CvDraftComparisonService } from "@/backend/services/cv-import/cv-draft-comparison-service";
import { CvImportServiceError } from "@/backend/services/cv-import/cv-http-errors";
import { getCvImportResource } from "@/backend/services/cv-import/cv-import-projection";
import { CvConfirmationReceipt } from "@/frontend/features/cv-import/components/cv-confirmation-receipt";
import { CvDraftReview } from "@/frontend/features/cv-import/components/cv-draft-review";
import { cvStatusLabel } from "@/frontend/features/cv-import/i18n/cv-import-copy";
import { ProfileNavigation } from "@/frontend/features/profile/components/profile-navigation";
import { cvUploadIdSchema } from "@/shared/contracts/cv-import/common";
import type { CvDraftComparison } from "@/shared/contracts/cv-import/review";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CvDraftReviewPage({
  params,
}: {
  params: Promise<{ uploadId: string }>;
}) {
  const { uploadId } = await params;
  const parsed = cvUploadIdSchema.safeParse(uploadId);
  if (!parsed.success) notFound();
  const context = await getWorkspaceContext();
  if (!context)
    redirect(
      `/login?returnTo=${encodeURIComponent(`/profile/cv-imports/${uploadId}/review`)}`,
    );

  let resource: Awaited<ReturnType<typeof getCvImportResource>>;
  try {
    resource = await getCvImportResource(context.userId, parsed.data);
  } catch (error) {
    if (
      error instanceof CvImportServiceError &&
      ["CV_IMPORT_NOT_FOUND", "CV_DRAFT_NOT_FOUND"].includes(error.code)
    )
      notFound();
    throw error;
  }

  if (!("draft" in resource)) notFound();

  let initial: CvDraftComparison | null = null;
  if (
    !resource.receipt &&
    resource.draft &&
    resource.status === "REVIEW_READY"
  ) {
    try {
      initial = await new CvDraftComparisonService().get(
        context.userId,
        resource.draft.draftId,
      );
    } catch (error) {
      if (
        error instanceof CvImportServiceError &&
        error.code === "CV_DRAFT_NOT_FOUND"
      )
        notFound();
      throw error;
    }
  }

  const vi = context.initialLocale === "vi";
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link
          className={styles.backLink}
          href={`/profile/cv-imports/${resource.uploadId}`}
        >
          <span aria-hidden="true">←</span>{" "}
          {vi ? "Quay lại trạng thái nhập" : "Back to import status"}
        </Link>
        <div className={styles.context}>
          <p>
            {vi ? "NHẬP CV DO NGƯỜI DÙNG XEM XÉT" : "HUMAN-REVIEWED IMPORT"}
          </p>
          <strong>
            {vi
              ? "Bạn vẫn kiểm soát mọi thay đổi hồ sơ."
              : "You remain in control of every profile change."}
          </strong>
        </div>
      </header>
      <ProfileNavigation active="cv-imports" />
      <div className={styles.content}>
        {resource.receipt ? (
          <CvConfirmationReceipt receipt={resource.receipt} />
        ) : initial ? (
          <CvDraftReview csrfProof={context.csrfProof} initial={initial} />
        ) : (
          <section
            className={styles.unavailable}
            aria-labelledby="review-unavailable-heading"
          >
            <span aria-hidden="true">i</span>
            <div>
              <h1 id="review-unavailable-heading">
                {vi ? "Không thể xem xét CV" : "CV review is not available"}
              </h1>
              <p role="status">
                {vi ? "Trạng thái nhập hiện tại: " : "Current import status: "}
                {cvStatusLabel(context.initialLocale, resource.status)}.
              </p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
