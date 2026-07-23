import { SessionList } from "@/components/auth/session-list";
import { ProfileNavigation } from "@/components/auth/profile-navigation";

export default function ProfileSessionsPage() {
  return (
    <div className="profile-page profile-page--standalone">
      <ProfileNavigation active="sessions" />
      <SessionList />
    </div>
  );
}
