import { redirect } from "next/navigation";

import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { listCvImports } from "@/backend/services/cv-import/cv-import-projection";
import { CvImportPage } from "@/frontend/features/cv-import/components/cv-import-page";
import { ProfileNavigation } from "@/frontend/features/profile/components/profile-navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CvImportsPage() {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Fprofile%2Fcv-imports");
  const imports = await listCvImports(context.userId);
  return (
    <main>
      <header>
        <p>YOUR SMART HIRE ACCOUNT</p>
        <h1 id="workspace-page-title">CV imports</h1>
        <p>
          Upload a PDF or DOCX, then review a private draft before changing your
          profile.
        </p>
      </header>
      <ProfileNavigation active="cv-imports" />
      <CvImportPage
        csrfProof={context.csrfProof}
        initialItems={imports.items}
      />
    </main>
  );
}
