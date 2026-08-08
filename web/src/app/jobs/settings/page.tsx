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
  const copy =
    context.initialLocale === "vi"
      ? {
          kicker: "KHÔNG GIAN ỨNG VIÊN",
          title: "Cài đặt gợi ý việc làm",
          description:
            "Cập nhật nhu cầu để SmartHire tìm các cơ hội phù hợp với bạn.",
        }
      : {
          kicker: "CANDIDATE WORKSPACE",
          title: "Job Recommendation Settings",
          description:
            "Update your preferences so SmartHire can find relevant opportunities for you.",
        };

  return (
    <JobsWorkspace activeTab="settings">
      <section
        className="jobs-workspace-section"
        aria-labelledby="job-settings-heading"
      >
        <header className="jobs-workspace-heading">
          <div>
            <p className="workspace-kicker">{copy.kicker}</p>
            <h1 id="job-settings-heading">{copy.title}</h1>
            <p>{copy.description}</p>
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
