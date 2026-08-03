import type { Metadata } from "next";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import { serverEnvironment } from "@/backend/env/runtime";
import "./globals.css";
import { Toaster } from "sonner";
import { AppProviders } from "@/frontend/providers/app-providers";

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
        <AppProviders>
          {children}
          <Toaster
            className="app-toaster"
            position="top-right"
            richColors
            toastOptions={{ className: "app-toast" }}
          />
        </AppProviders>
      </body>
    </html>
  );
}
