"use client";

import { useForm } from "react-hook-form";
import type { PendingEmailChange } from "@/shared/contracts/account/identity";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import {
  UnsavedChangesIndicator,
  useUnsavedChangesGuard,
} from "../client/unsaved-changes";

type EmailChangeValues = {
  newEmail: string;
  currentPassword: string;
};

export function EmailChangeForm({
  pending,
  requesting,
  onRequest,
}: {
  pending: PendingEmailChange | null;
  requesting: boolean;
  onRequest: (newEmail: string, currentPassword: string) => Promise<boolean>;
}) {
  const locale = useWorkspaceLocale();
  const copy =
    locale === "vi"
      ? {
          kicker: "ĐỊA CHỈ ĐĂNG NHẬP ĐÃ XÁC MINH",
          title: "Thay đổi email",
          pending: (email: string) => `Đang chờ xác minh ${email}`,
          pendingCopy: (date: string) =>
            `Email hiện tại vẫn hoạt động cho đến khi xác nhận. Yêu cầu này hết hạn vào ${date}.`,
          intro:
            "Địa chỉ hiện tại vẫn là email đăng nhập cho đến khi địa chỉ mới được xác minh.",
          proposed: "Email mới",
          password: "Mật khẩu hiện tại",
          requesting: "Đang gửi yêu cầu xác minh...",
          request: "Gửi email xác minh",
          guidance:
            "Email được gửi bất đồng bộ. Nếu chưa nhận được, hãy giữ nguyên thông tin và thử gửi lại trước khi chọn địa chỉ khác.",
        }
      : {
          kicker: "VERIFIED LOGIN ADDRESS",
          title: "Change email",
          pending: (email: string) => `Verification pending for ${email}`,
          pendingCopy: (date: string) =>
            `The current email remains active until confirmation. This request expires ${date}.`,
          intro:
            "The current address remains your login until the proposed address is verified.",
          proposed: "Proposed email",
          password: "Current password",
          requesting: "Requesting verification...",
          request: "Request verification email",
          guidance:
            "Delivery is asynchronous. If mail does not arrive, keep these values and retry the same request before choosing a different address.",
        };
  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<EmailChangeValues>({
    defaultValues: { newEmail: "", currentPassword: "" },
  });
  useUnsavedChangesGuard(isDirty);

  return (
    <section
      className="account-identity-panel"
      aria-labelledby="email-change-title"
    >
      <div className="account-panel-heading">
        <div>
          <p className="panel-kicker">{copy.kicker}</p>
          <h2 id="email-change-title">{copy.title}</h2>
          <UnsavedChangesIndicator dirty={isDirty} />
        </div>
      </div>
      {pending ? (
        <div className="email-change-pending">
          <strong>{copy.pending(pending.proposedEmail)}</strong>
          <span>
            {copy.pendingCopy(
              new Date(pending.expiresAt).toLocaleString(
                locale === "vi" ? "vi-VN" : "en",
              ),
            )}
          </span>
        </div>
      ) : (
        <p className="account-panel-copy">{copy.intro}</p>
      )}
      <form
        onSubmit={handleSubmit(async ({ newEmail, currentPassword }) => {
          if (await onRequest(newEmail, currentPassword)) reset();
        })}
      >
        <label htmlFor="proposed-email">{copy.proposed}</label>
        <input
          id="proposed-email"
          type="email"
          maxLength={320}
          autoComplete="email"
          {...register("newEmail")}
        />
        <label htmlFor="email-change-current-password">{copy.password}</label>
        <input
          id="email-change-current-password"
          type="password"
          maxLength={128}
          autoComplete="current-password"
          {...register("currentPassword")}
        />
        <button type="submit" disabled={requesting}>
          {requesting ? copy.requesting : copy.request}
        </button>
      </form>
      <p className="account-panel-guidance">{copy.guidance}</p>
    </section>
  );
}
