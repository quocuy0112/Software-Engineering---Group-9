import { SecurityShell } from "@/components/auth/security-shell";
import { headers } from "next/headers"; import { redirect } from "next/navigation"; import { requireSession } from "@/server/auth/require-session";
export default async function SettingsLayout({ children }: { children: React.ReactNode }) { if(!await requireSession(await headers()))redirect("/login?returnTo=%2Fsettings%2Fsessions");return <SecurityShell>{children}</SecurityShell>; }
