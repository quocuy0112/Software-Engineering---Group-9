"use client";

import type { AccountPreferences } from "@/shared/contracts/account/preferences";

type Notifications = AccountPreferences["emailNotifications"];

export function NotificationPreferences({
  value,
  onChange,
}: {
  value: Notifications;
  onChange: (value: Notifications) => void;
}) {
  return (
    <fieldset className="notification-preferences">
      <legend>Email notifications</legend>
      <label>
        <input
          type="checkbox"
          aria-label="Application updates"
          checked={value.application_updates}
          onChange={(event) =>
            onChange({
              ...value,
              application_updates: event.target.checked,
            })
          }
        />
        <span>
          <strong>Application updates</strong>
          <small>Status changes for applications and interviews.</small>
        </span>
      </label>
      <label>
        <input
          type="checkbox"
          aria-label="Job recommendations"
          checked={value.job_recommendations}
          onChange={(event) =>
            onChange({
              ...value,
              job_recommendations: event.target.checked,
            })
          }
        />
        <span>
          <strong>Job recommendations</strong>
          <small>Relevant opportunity suggestions.</small>
        </span>
      </label>
      <label className="notification-preferences__mandatory">
        <input
          type="checkbox"
          aria-label="Account security"
          checked
          disabled
          aria-describedby="account-security-notification-explanation"
          readOnly
        />
        <span>
          <strong>Account security</strong>
          <small id="account-security-notification-explanation">
            Required security notices stay enabled and cannot be disabled.
          </small>
        </span>
      </label>
    </fieldset>
  );
}
