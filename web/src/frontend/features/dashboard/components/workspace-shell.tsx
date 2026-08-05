"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { postWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";
import { AuthStatus } from "@/frontend/features/authentication/components/auth-status";
import { SmartHireBrand } from "@/frontend/components/ui/smarthire-brand";
import {
  ACCOUNT_NAME_UPDATED_EVENT,
  type AccountNameUpdatedDetail,
} from "@/frontend/features/profile/client/account-identity-events";
import { ThemeToggle } from "@/frontend/components/ui/theme-toggle";
import {
  WORKSPACE_LOCALE_UPDATED_EVENT,
  type WorkspaceLocale,
  type WorkspaceLocaleUpdatedDetail,
  WorkspaceLocaleProvider,
} from "../client/workspace-locale";
import { WorkspaceNavigation } from "./workspace-navigation";

export function WorkspaceShell({
  children,
  csrfProof,
  profile = { name: "SmartHire member", email: "" },
}: {
  children: React.ReactNode;
  csrfProof: string;
  profile?: {
    name: string;
    email: string;
    image?: string | null;
    locale?: "vi" | "en";
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [navigating, startNavigation] = useTransition();
  const [status, setStatus] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [localeOverride, setLocaleOverride] = useState<WorkspaceLocale | null>(
    null,
  );

  useEffect(() => {
    const synchronizeName = (event: Event) => {
      const name = (event as CustomEvent<AccountNameUpdatedDetail>).detail
        ?.name;
      if (typeof name !== "string" || !name.trim()) return;
      setNameOverride(name);
      router.refresh();
    };
    const synchronizeLocale = (event: Event) => {
      const locale = (event as CustomEvent<WorkspaceLocaleUpdatedDetail>).detail
        ?.locale;
      if (locale !== "vi" && locale !== "en") return;
      setLocaleOverride(locale);
      router.refresh();
    };
    window.addEventListener(ACCOUNT_NAME_UPDATED_EVENT, synchronizeName);
    window.addEventListener(WORKSPACE_LOCALE_UPDATED_EVENT, synchronizeLocale);
    return () => {
      window.removeEventListener(ACCOUNT_NAME_UPDATED_EVENT, synchronizeName);
      window.removeEventListener(
        WORKSPACE_LOCALE_UPDATED_EVENT,
        synchronizeLocale,
      );
    };
  }, [router]);

  const workspaceProfile = nameOverride
    ? { ...profile, name: nameOverride }
    : profile;

  const avatar = /^data:image\/(?:png|jpeg);base64,/u.test(
    workspaceProfile.image ?? "",
  )
    ? workspaceProfile.image
    : null;
  const locale = localeOverride ?? workspaceProfile.locale ?? "en";
  const copy =
    locale === "vi"
      ? {
          product: "Không gian nghề nghiệp",
          sidebar: "Thanh bên không gian làm việc",
          expand: "Mở rộng thanh điều hướng",
          collapse: "Thu gọn thanh điều hướng",
          workspace: "Hồ sơ ứng viên",
          greeting: "Rất vui được gặp bạn",
          openProfile: `Mở hồ sơ của ${workspaceProfile.name}`,
          manageProfile: "Quản lý hồ sơ",
          signOutError: "Không thể đăng xuất. Vui lòng thử lại.",
        }
      : {
          product: "Talent workspace",
          sidebar: "Workspace sidebar",
          expand: "Expand workspace sidebar",
          collapse: "Collapse workspace sidebar",
          workspace: "Candidate workspace",
          greeting: "Good to see you",
          openProfile: `Open profile for ${workspaceProfile.name}`,
          manageProfile: "Manage your profile",
          signOutError: "Unable to sign out. Please try again.",
        };

  async function signOut() {
    if (busy || navigating) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await postWithCurrentCsrf(
        "/api/identity/logout",
        csrfProof,
      );
      if (!response.ok) {
        setStatus(copy.signOutError);
        return;
      }
      startNavigation(() => router.replace("/login"));
    } catch {
      setStatus(copy.signOutError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <WorkspaceLocaleProvider locale={locale}>
      <main className="workspace-page" lang={locale}>
        <div
          className="workspace-layout"
          data-sidebar-collapsed={sidebarCollapsed}
        >
          <aside
            className="workspace-sidebar"
            aria-label={copy.sidebar}
            data-collapsed={sidebarCollapsed}
          >
            <div className="workspace-sidebar-header">
              <div className="workspace-sidebar-brand">
                <SmartHireBrand />
                <span className="workspace-product-label">{copy.product}</span>
              </div>
              <button
                className="workspace-sidebar-toggle"
                type="button"
                aria-controls="workspace-navigation"
                aria-expanded={!sidebarCollapsed}
                aria-label={sidebarCollapsed ? copy.expand : copy.collapse}
                title={sidebarCollapsed ? copy.expand : copy.collapse}
                onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
              >
                <svg aria-hidden="true" viewBox="0 0 20 20">
                  <path
                    d={sidebarCollapsed ? "m7 4 6 6-6 6" : "m13 4-6 6 6 6"}
                  />
                </svg>
              </button>
            </div>
            <WorkspaceNavigation
              busy={busy || navigating}
              collapsed={sidebarCollapsed}
              onSignOut={() => void signOut()}
            />
          </aside>
          <div className="workspace-main">
            <header className="workspace-header">
              <div>
                <p className="workspace-topbar-kicker">{copy.workspace}</p>
                <p className="workspace-topbar-title">{copy.greeting}</p>
              </div>
              <div className="workspace-header-actions">
                <ThemeToggle />
                <Link
                  className="workspace-account-chip"
                  href="/profile"
                  aria-label={copy.openProfile}
                >
                  <span className="workspace-account-avatar" aria-hidden="true">
                    {avatar ? (
                      <Image
                        src={avatar}
                        alt=""
                        width={40}
                        height={40}
                        unoptimized
                      />
                    ) : (
                      <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="8" r="3.2" />
                        <path d="M5.5 19c.7-3.1 3-4.8 6.5-4.8s5.8 1.7 6.5 4.8" />
                      </svg>
                    )}
                  </span>
                  <span>
                    <strong>{workspaceProfile.name}</strong>
                    <small>
                      {workspaceProfile.email || copy.manageProfile}
                    </small>
                  </span>
                </Link>
              </div>
            </header>
            <div className="workspace-status">
              <AuthStatus status={status} tone="error" />
            </div>
            <section className="workspace-content">{children}</section>
          </div>
        </div>
      </main>
    </WorkspaceLocaleProvider>
  );
}
