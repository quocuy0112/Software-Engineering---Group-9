import Link from "next/link";
import { SmartHireBrand } from "@/frontend/components/ui/smarthire-brand";
import { homeCopy } from "../home-copy";
import type { HomeLocale } from "../home-page-model";

export function HomeFooter({
  locale,
  showCompanies,
}: {
  locale: HomeLocale;
  showCompanies: boolean;
}) {
  const copy = homeCopy[locale];
  const currentYear = new Date().getFullYear();
  const copyrightYear =
    currentYear > copy.footer.establishedYear
      ? `${copy.footer.establishedYear}–${currentYear}`
      : String(copy.footer.establishedYear);
  return (
    <footer className="home-footer">
      <div className="home-footer-intro">
        <div className="home-footer-brand">
          <SmartHireBrand />
        </div>
        <p>{copy.footer.description}</p>
      </div>
      <div className="home-footer-directory">
        <nav aria-label={copy.footer.label}>
          <span className="home-footer-nav-title">{copy.footer.explore}</span>
          <div className="home-footer-links">
            <Link href="/jobs">{copy.footer.jobs}</Link>
            <Link href="#career-paths">{copy.navigation.careerPaths}</Link>
            <Link href="#how-it-works">{copy.navigation.howItWorks}</Link>
            {showCompanies ? (
              <Link href="#companies-hiring">{copy.footer.companies}</Link>
            ) : null}
          </div>
        </nav>
        <nav aria-label={copy.footer.informationLabel}>
          <span className="home-footer-nav-title">
            {copy.footer.information}
          </span>
          <div className="home-footer-links">
            <Link href="/legal/ai-cv-analysis-policy">
              {copy.footer.aiCvPolicy}
            </Link>
          </div>
        </nav>
      </div>
      <div className="home-footer-meta">
        <p>
          {copy.footer.copyright.replace("{year}", copyrightYear)}
        </p>
        <p>{copy.footer.aiNotice}</p>
      </div>
    </footer>
  );
}
