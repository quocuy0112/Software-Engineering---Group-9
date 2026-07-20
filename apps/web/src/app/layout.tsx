import type { Metadata } from "next";
import { serverEnvironment } from "@/lib/env/runtime";
import "./globals.css";

export const metadata: Metadata = { title: "SmartHire", description: "SmartHire local workspace" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-app-environment={serverEnvironment.APP_ENV}><body>{children}</body></html>;
}
