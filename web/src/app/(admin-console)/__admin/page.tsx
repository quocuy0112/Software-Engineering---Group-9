import { AdminApp } from "@/frontend/features/admin";
export const dynamic = "force-dynamic";
export const metadata = { title: "SmartHire Platform Administration", robots: { index: false, follow: false } };
export default function AdminConsolePage() { return <AdminApp />; }
