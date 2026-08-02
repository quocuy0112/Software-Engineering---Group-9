"use client";

import { ProfileNavigation } from "./profile-navigation";
import { SessionList } from "./session-list";

export function ProfileSessionsView() {
  return (
    <div className="profile-page profile-page--standalone">
      <ProfileNavigation active="sessions" />
      <SessionList />
    </div>
  );
}
