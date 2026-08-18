import "@/frontend/features/private-cv-match/styles/private-cv-match.css";
import { AppProviders } from "@/frontend/providers/app-providers";

export default function PrivateMatchJobsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppProviders>{children}</AppProviders>;
}
