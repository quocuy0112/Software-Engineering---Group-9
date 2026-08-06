import { redirect } from "next/navigation";

import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { cvConfiguration, cvParserAvailability } from "@/backend/cv/config";
import { listCvImports } from "@/backend/services/cv-import/cv-import-projection";
import { CvImportWorkspace } from "@/frontend/features/cv-import/components/cv-import-workspace";
import { ProfileNavigation } from "@/frontend/features/profile/components/profile-navigation";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CvImportsPage() {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Fprofile%2Fcv-imports");
  const imports = await listCvImports(context.userId);
  const parserAvailability = cvParserAvailability(cvConfiguration);
  const vi = context.initialLocale === "vi";
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>
            {vi ? "TÀI KHOẢN SMARTHIRE" : "YOUR SMARTHIRE ACCOUNT"}
          </p>
          <h1 id="workspace-page-title">
            {vi
              ? "Biến CV thành cập nhật hồ sơ"
              : "Turn your CV into profile updates"}
          </h1>
          <p className={styles.lede}>
            {vi
              ? "Tải lên PDF hoặc DOCX, để SmartHire xử lý riêng tư, sau đó xem xét từng đề xuất trước khi hồ sơ của bạn thay đổi."
              : "Upload a PDF or DOCX, let SmartHire process it privately, then review every suggestion before anything changes on your profile."}
          </p>
        </div>
        <div
          className={styles.importCount}
          aria-label={
            vi ? "Số lần nhập CV được lưu giữ" : "Retained CV imports"
          }
        >
          <strong>{imports.items.length}</strong>
          <span>
            {vi
              ? `trên ${imports.limits.maximumImports} lần nhập được lưu giữ`
              : `of ${imports.limits.maximumImports} imports retained`}
          </span>
          <small>
            {vi ? "PDF hoặc DOCX · tối đa 5 MB" : "PDF or DOCX · up to 5 MB"}
          </small>
        </div>
      </header>

      <ol
        className={styles.workflow}
        aria-label={vi ? "Quy trình nhập CV" : "CV import workflow"}
      >
        <li>
          <span>1</span>
          <div>
            <strong>{vi ? "Tải lên" : "Upload"}</strong>
            <small>
              {vi ? "Chọn CV được hỗ trợ" : "Choose a supported CV"}
            </small>
          </div>
        </li>
        <li>
          <span>2</span>
          <div>
            <strong>{vi ? "Xử lý an toàn" : "Process securely"}</strong>
            <small>
              {vi
                ? "Quét, trích xuất và phân tích"
                : "Scan, extract, and parse"}
            </small>
          </div>
        </li>
        <li>
          <span>3</span>
          <div>
            <strong>{vi ? "Xem xét và áp dụng" : "Review and apply"}</strong>
            <small>
              {vi ? "Bạn phê duyệt mọi thay đổi" : "You approve every change"}
            </small>
          </div>
        </li>
      </ol>

      <ProfileNavigation active="cv-imports" />
      <CvImportWorkspace
        csrfProof={context.csrfProof}
        initialItems={imports.items}
        parserAvailability={parserAvailability}
      />
    </main>
  );
}
