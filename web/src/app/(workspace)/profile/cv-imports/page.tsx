import { redirect } from "next/navigation";

import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
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
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>YOUR SMARTHIRE ACCOUNT</p>
          <h1 id="workspace-page-title">Turn your CV into profile updates</h1>
          <p className={styles.lede}>
            Upload a PDF or DOCX, let SmartHire process it privately, then
            review every suggestion before anything changes on your profile.
          </p>
        </div>
        <div className={styles.importCount} aria-label="Retained CV imports">
          <strong>{imports.items.length}</strong>
          <span>of 10 imports retained</span>
          <small>PDF or DOCX · up to 5 MB</small>
        </div>
      </header>

      <ol className={styles.workflow} aria-label="CV import workflow">
        <li>
          <span>1</span>
          <div>
            <strong>Upload</strong>
            <small>Choose a supported CV</small>
          </div>
        </li>
        <li>
          <span>2</span>
          <div>
            <strong>Process securely</strong>
            <small>Scan, extract, and parse</small>
          </div>
        </li>
        <li>
          <span>3</span>
          <div>
            <strong>Review and apply</strong>
            <small>You approve every change</small>
          </div>
        </li>
      </ol>

      <ProfileNavigation active="cv-imports" />
      <CvImportWorkspace
        csrfProof={context.csrfProof}
        initialItems={imports.items}
      />
    </main>
  );
}
