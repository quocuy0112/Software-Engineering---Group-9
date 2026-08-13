import Link from "next/link";
import { SmartHireBrand } from "@/frontend/components/ui/smarthire-brand";
import { homeCopy } from "../home-copy";
import type { HomeLocale } from "../home-page-model";

export function HomeFooter({ locale }: { locale: HomeLocale }) {
  const copy = homeCopy[locale];
  return (
    <footer className="home-footer">
      <div className="home-footer-brand"><SmartHireBrand /></div><p>{copy.footer.description}</p>
      <nav aria-label={copy.footer.label}><Link href="/jobs">{copy.footer.jobs}</Link><Link href="#community">{copy.navigation.community}</Link><Link href="#employer-spotlight">{copy.footer.companies}</Link><Link href="#events">{copy.navigation.events}</Link></nav>
    </footer>
  );
}
