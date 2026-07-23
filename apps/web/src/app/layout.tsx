import type { Metadata } from "next";
import { serverEnvironment } from "@/lib/env/runtime";
import "./globals.css";
import { Toaster } from "sonner";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "SmartHire | Talent Workspace",
  description:
    "A secure talent workspace designed to help candidates and hiring teams make meaningful connections.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-app-environment={serverEnvironment.APP_ENV}>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
        <Toaster richColors />
      </body>
    </html>
  );
}
