import "../../../frontend/features/private-cv-match/styles/private-cv-match.css";
import { AppProviders } from "@/frontend/providers/app-providers";

// The Candidate shell is intentionally supplied by the parent
// app/(workspace)/layout.tsx. This feature layout only adds its query
// provider and feature styles, so the setup and report cannot drift into a
// standalone page without the shared sidebar/header.
export default function CvMatchCheckLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppProviders>{children}</AppProviders>;
}
