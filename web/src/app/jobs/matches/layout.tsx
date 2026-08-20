import "@/frontend/features/private-cv-match/styles/private-cv-match.css";
import { AppProviders } from "@/frontend/providers/app-providers";

// The parent app/jobs/layout.tsx supplies the shared Candidate WorkspaceShell.
// Keep feature providers and styles at the matches-tree boundary so setup and
// report routes cannot drift into standalone pages independently.
export default function PrivateMatchMatchesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppProviders>{children}</AppProviders>;
}
