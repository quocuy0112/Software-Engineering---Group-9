"use client";

import dynamic from "next/dynamic";

const ClientOnlyAdminApp = dynamic(
  () => import("./admin-app").then((module) => module.AdminApp),
  {
    ssr: false,
    loading: () => (
      <main aria-busy="true" aria-live="polite">
        Loading administration console…
      </main>
    ),
  },
);

export function AdminConsoleClient() {
  return <ClientOnlyAdminApp />;
}
