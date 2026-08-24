import "../../frontend/styles/home.css";
import "../../frontend/features/support/styles/support-help.css";
import "../../frontend/styles/home-public-support.css";
import { HomePublicSupportPage } from "@/frontend/features/home/components/home-public-support-page";

export const metadata = { title: "Help & support · SmartHire" };

export default function PublicHelpPage() {
  return <HomePublicSupportPage />;
}
