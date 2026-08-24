import "../../../frontend/styles/home.css";
import "../../../frontend/styles/home-legal.css";
import { HomeLegalInformationPage } from "@/frontend/features/home/components/home-legal-information-page";

export const metadata = { title: "Terms · SmartHire" };

export default function TermsPage() {
  return <HomeLegalInformationPage kind="terms" />;
}
