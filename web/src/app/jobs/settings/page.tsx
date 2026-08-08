import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { readJobWorkspaceSnapshot } from "@/backend/services/jobs/job-workspace-data";
import { JobPreferencesForm } from "@/frontend/features/jobs/components/job-preferences-form";
import { JobsWorkspace } from "@/frontend/features/jobs/components/jobs-workspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function JobSettingsRoute() {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Fjobs%2Fsettings");
  const snapshot = await readJobWorkspaceSnapshot(context.userId);
  return (
    <JobsWorkspace activeTab="settings">
      <section
        className="jobs-workspace-section"
        aria-labelledby="job-settings-heading"
      >
        <header className="jobs-workspace-heading">
          <div>
            <p className="workspace-kicker">CANDIDATE WORKSPACE</p>
            <h1 id="job-settings-heading">Cài đặt gợi ý việc làm</h1>
            <p>Cập nhật nhu cầu để SmartHire tìm các cơ hội phù hợp với bạn.</p>
          </div>
        </header>
        <JobPreferencesForm
          initialPreferences={snapshot.state.jobPreferences}
          positionOptions={snapshot.positionOptions}
          skillOptions={snapshot.skillOptions}
        />
      </section>
    </JobsWorkspace>
  );
}
