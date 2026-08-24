import "../../../frontend/styles/home.css";
import "../../../frontend/styles/home-ai-cv-policy.css";
import { HomeAiCvPolicyPage } from "@/frontend/features/home/components/home-ai-cv-policy-page";

export const metadata = {
  title: "AI & CV analysis policy · SmartHire",
  description:
    "SmartHire's policy for optional and transparent AI-assisted CV analysis.",
};

export default function AiCvAnalysisPolicyPage() {
  return <HomeAiCvPolicyPage />;
}
