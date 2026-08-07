import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { getCvImportResource } from "@/backend/services/cv-import/cv-import-projection";
import { CvImportServiceError } from "@/backend/services/cv-import/cv-http-errors";
import { CvImportStatus } from "@/frontend/features/cv-import/components/cv-import-status";
import { CvConfirmationReceipt } from "@/frontend/features/cv-import/components/cv-confirmation-receipt";
import { cvStatusLabel } from "@/frontend/features/cv-import/i18n/cv-import-copy";
import { ProfileNavigation } from "@/frontend/features/profile/components/profile-navigation";
import { cvUploadIdSchema } from "@/shared/contracts/cv-import/common";
import { cvStatusPollingAfterMs } from "@/shared/contracts/cv-import/upload";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CvImportStatusPage({
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
      `/login?returnTo=${encodeURIComponent(`/profile/cv-imports/${uploadId}`)}`,
    );
  let resource: Awaited<ReturnType<typeof getCvImportResource>>;
  try {
    resource = await getCvImportResource(context.userId, parsed.data);
  } catch (error) {
    if (
      error instanceof CvImportServiceError &&
      error.code === "CV_IMPORT_NOT_FOUND"
    )
      notFound();
    throw error;
  }
  const pollingAfterMs =
    "stage" in resource
      ? cvStatusPollingAfterMs(resource.status)
      : resource.status === "CANCELLED" && resource.deletedAt === null
        ? 2_000
        : null;
  const vi = context.initialLocale === "vi";
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link className={styles.backLink} href="/profile/cv-imports">
            <span aria-hidden="true">←</span>{" "}
            {vi ? "Quay lại danh sách nhập CV" : "Back to CV imports"}
          </Link>
          <p className={styles.kicker}>
            {vi ? "XỬ LÝ CV RIÊNG TƯ" : "PRIVATE CV PROCESSING"}
          </p>
          <h1 id="workspace-page-title">
            {vi ? "Trạng thái nhập CV" : "CV import status"}
          </h1>
          <p className={styles.lede}>
            {vi
              ? "Theo dõi từng giai đoạn xử lý, thực hiện hành động cần thiết và mở phần xem xét khi bản nháp riêng đã sẵn sàng."
              : "Follow each processing stage, handle any required action, and open the review when your private draft is ready."}
          </p>
        </div>
        <span className={styles.privacyBadge}>
          {vi ? "Riêng tư · tạm thời" : "Private · temporary"}
        </span>
      </header>
      <ProfileNavigation active="cv-imports" />
      <div className={styles.content}>
        <CvImportStatus
          csrfProof={context.csrfProof}
          resource={{ ...resource, pollingAfterMs }}
        />
        {"stage" in resource && resource.receipt ? (
          <CvConfirmationReceipt receipt={resource.receipt} />
        ) : null}
        <p className="sr-only" aria-live="polite">
          {vi ? "Trạng thái hiện tại: " : "Current status: "}
          {cvStatusLabel(context.initialLocale, resource.status)}
        </p>
      </div>
    </main>
  );
}
