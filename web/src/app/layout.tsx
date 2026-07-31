import type { Metadata } from "next";
import "@fontsource-variable/inter/wght.css";
import { serverEnvironment } from "@/backend/env/runtime";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "SmartHire - A secure talent workspace",
  description:
    "A secure talent workspace designed to help candidates and hiring teams make meaningful connections.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-app-environment={serverEnvironment.APP_ENV}>
      <body suppressHydrationWarning>
        {children}
        <Toaster
          className="app-toaster"
          position="top-right"
          richColors
          toastOptions={{ className: "app-toast" }}
        />
      </body>
    </html>
  );
}
