"use client";

import type { AccountPreferences } from "@/shared/contracts/account/preferences";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";

type Notifications = AccountPreferences["emailNotifications"];

export function NotificationPreferences({
  value,
  onChange,
}: {
  value: Notifications;
  onChange: (value: Notifications) => void;
}) {
  const locale = useWorkspaceLocale();
  const copy =
    locale === "vi"
      ? {
          legend: "Thông báo email",
          application: "Cập nhật ứng tuyển",
          applicationHint: "Thay đổi trạng thái ứng tuyển và phỏng vấn.",
          jobs: "Gợi ý việc làm",
          jobsHint: "Gợi ý các cơ hội phù hợp.",
          security: "Bảo mật tài khoản",
          securityHint: "Thông báo bảo mật bắt buộc luôn bật và không thể tắt.",
        }
      : {
          legend: "Email notifications",
          application: "Application updates",
          applicationHint: "Status changes for applications and interviews.",
          jobs: "Job recommendations",
          jobsHint: "Relevant opportunity suggestions.",
          security: "Account security",
          securityHint:
            "Required security notices stay enabled and cannot be disabled.",
        };
  return (
    <fieldset className="notification-preferences">
      <legend>{copy.legend}</legend>
      <label>
        <input
          type="checkbox"
          aria-label={copy.application}
          checked={value.application_updates}
          onChange={(event) =>
            onChange({
              ...value,
              application_updates: event.target.checked,
            })
          }
        />
        <span>
          <strong>{copy.application}</strong>
          <small>{copy.applicationHint}</small>
        </span>
      </label>
      <label>
        <input
          type="checkbox"
          aria-label={copy.jobs}
          checked={value.job_recommendations}
          onChange={(event) =>
            onChange({
              ...value,
              job_recommendations: event.target.checked,
            })
          }
        />
        <span>
          <strong>{copy.jobs}</strong>
          <small>{copy.jobsHint}</small>
        </span>
      </label>
      <label className="notification-preferences__mandatory">
        <input
          type="checkbox"
          aria-label={copy.security}
          checked
          disabled
          aria-describedby="account-security-notification-explanation"
          readOnly
        />
        <span>
          <strong>{copy.security}</strong>
          <small id="account-security-notification-explanation">
            {copy.securityHint}
          </small>
        </span>
      </label>
    </fieldset>
  );
}
