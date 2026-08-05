import type { Metadata } from "next";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import { serverEnvironment } from "@/backend/env/runtime";
import "./globals.css";
import { Toaster } from "sonner";
import { AppProviders } from "@/frontend/providers/app-providers";

const themeInitializationScript = `
(function () {
  try {
    var stored = window.localStorage.getItem("smarthire_theme");
    var theme = stored === "light" || stored === "dark" || stored === "system"
      ? stored
      : "system";
    var isDark = theme === "dark" || (
      theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
    var root = document.documentElement;
    root.dataset.theme = isDark ? "dark" : "light";
    root.classList.toggle("dark", isDark);
  } catch (_) {
    document.documentElement.dataset.theme = "light";
  }
})();
`;

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
      suppressHydrationWarning
    >
      <head>
        <script
          id="theme-initializer"
          dangerouslySetInnerHTML={{ __html: themeInitializationScript }}
        />
      </head>
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
