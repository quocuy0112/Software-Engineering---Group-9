import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ProfileNavigation } from "@/components/auth/profile-navigation";
import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/server/auth/require-session";

export default async function ProfilePage() {
  const current = await requireSession(await headers());
  if (!current) redirect("/login?returnTo=%2Fprofile");

  const account = await prisma.userAccount.findUnique({
    where: { id: current.userId },
    select: {
      name: true,
      email: true,
      twoFactorEnabled: true,
      createdAt: true,
    },
  });
  if (!account) redirect("/login?returnTo=%2Fprofile");

  return (
    <div className="profile-page">
      <header className="page-heading profile-heading">
        <div>
          <p className="workspace-kicker">YOUR SMART HIRE ACCOUNT</p>
          <h1 id="workspace-page-title">Profile</h1>
          <p className="page-heading-copy">
            Manage your identity, sign-in protection, and active sessions in one
            place.
          </p>
        </div>
        <span className="page-heading-badge page-heading-badge--secure">
          {account.twoFactorEnabled ? "2FA enabled" : "2FA not enabled"}
        </span>
      </header>
      <ProfileNavigation active="overview" />

      <section
        id="security"
        className="profile-section"
        aria-labelledby="profile-security-title"
      >
        <div className="profile-section-heading">
          <div>
            <p className="workspace-kicker">Account &amp; Information</p>
            <h2 id="profile-security-title">Security</h2>
          </div>
        </div>
      </section>
    </div>
  );
}
