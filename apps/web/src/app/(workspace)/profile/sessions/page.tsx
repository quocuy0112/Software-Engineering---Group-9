import { SessionList } from "@/frontend/features/authentication/components/auth/session-list";
import { ProfileNavigation } from "@/frontend/features/authentication/components/auth/profile-navigation";

export default function ProfileSessionsPage() {
  return (
    <div className="profile-page profile-page--standalone">
      <ProfileNavigation active="sessions" />
      <SessionList />
    </div>
  );
}
