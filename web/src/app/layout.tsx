import type { Metadata } from "next";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import { serverEnvironment } from "@/backend/env/runtime";
import { ThemeProvider } from "@/frontend/providers/theme-provider";
import "./globals.css";
import { Toaster } from "sonner";
import { GlobalImageSearch } from "@/frontend/features/jobs/image-search/components/global-image-search";
import "@/frontend/features/jobs/image-search/styles/image-search.css";

export const metadata: Metadata = {
  title: "SmartHire - A secure talent workspace",
  description:
    "A secure talent workspace designed to help candidates and hiring teams make meaningful connections.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-app-environment={serverEnvironment.APP_ENV}
      data-theme="light"
    >
      <body suppressHydrationWarning>
        <ThemeProvider>
          <GlobalImageSearch />
          {children}
          <Toaster
            className="app-toaster"
            position="top-right"
            richColors
            toastOptions={{ className: "app-toast" }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
