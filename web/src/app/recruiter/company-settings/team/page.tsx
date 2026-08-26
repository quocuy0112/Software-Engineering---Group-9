import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { CompanyTeamService } from "@/backend/company-members/company-team-service";
import { CompanyTeamScreen } from "@/frontend/features/recruiter-workspace/company-team-screen";
export default async function TeamPage(){const c=await getWorkspaceContext();if(!c)redirect("/login?returnTo=%2Frecruiter%2Fcompany-settings%2Fteam");let team;try{team=await new CompanyTeamService().list(c.userId)}catch{redirect("/recruiter/company-settings")}return <CompanyTeamScreen {...team}/>}
