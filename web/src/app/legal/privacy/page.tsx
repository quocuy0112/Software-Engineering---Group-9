import "../../../frontend/styles/home.css";
import "../../../frontend/styles/home-legal.css";
import { HomeLegalInformationPage } from "@/frontend/features/home/components/home-legal-information-page";

export const metadata = { title: "Privacy · SmartHire" };

export default function PrivacyPage() {
  return <HomeLegalInformationPage kind="privacy" />;
}
