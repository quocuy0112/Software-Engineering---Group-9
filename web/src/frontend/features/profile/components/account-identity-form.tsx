"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { AccountIdentity } from "@/shared/contracts/account/identity";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import {
  UnsavedChangesIndicator,
  useUnsavedChangesGuard,
} from "../client/unsaved-changes";

export function AccountIdentityForm({
  identity,
  saving,
  onSave,
}: {
  identity: AccountIdentity;
  saving: boolean;
  onSave: (name: string) => Promise<boolean>;
}) {
  const locale = useWorkspaceLocale();
  const copy =
    locale === "vi"
      ? {
          kicker: "THÔNG TIN ĐỊNH DANH",
          title: "Họ tên và chi tiết tài khoản",
          fullName: "Họ và tên",
          saving: "Đang lưu họ tên...",
          save: "Lưu họ tên",
          email: "Email hiện tại",
          verification: "Xác minh email",
          verified: "Đã xác minh",
          notVerified: "Chưa xác minh",
          status: "Trạng thái tài khoản",
          active: "Đang hoạt động",
          created: "Ngày tạo tài khoản",
        }
      : {
          kicker: "ACCOUNT IDENTITY",
          title: "Full name and account details",
          fullName: "Full name",
          saving: "Saving full name...",
          save: "Save full name",
          email: "Current email",
          verification: "Email verification",
          verified: "Verified",
          notVerified: "Not verified",
          status: "Account status",
          active: "Active",
          created: "Account created",
        };
  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<{ name: string }>({
    defaultValues: { name: identity.name },
  });

  useEffect(() => {
    reset({ name: identity.name });
  }, [identity.name, reset]);
  useUnsavedChangesGuard(isDirty);

  return (
    <section
      className="account-identity-panel"
      aria-labelledby="identity-title"
    >
      <div className="account-panel-heading">
        <div>
          <p className="panel-kicker">{copy.kicker}</p>
          <h2 id="identity-title">{copy.title}</h2>
          <UnsavedChangesIndicator dirty={isDirty} />
        </div>
      </div>
      <form
        onSubmit={handleSubmit(async ({ name }) => {
          await onSave(name);
        })}
      >
        <label htmlFor="account-full-name">{copy.fullName}</label>
        <input
          id="account-full-name"
          maxLength={150}
          autoComplete="name"
          {...register("name")}
        />
        <button type="submit" disabled={saving}>
          {saving ? copy.saving : copy.save}
        </button>
      </form>
      <dl className="account-identity-metadata">
        <div>
          <dt>{copy.email}</dt>
          <dd>{identity.email}</dd>
        </div>
        <div>
          <dt>{copy.verification}</dt>
          <dd>{identity.emailVerified ? copy.verified : copy.notVerified}</dd>
        </div>
        <div>
          <dt>{copy.status}</dt>
          <dd>{copy.active}</dd>
        </div>
        <div>
          <dt>{copy.created}</dt>
          <dd>
            {new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en", {
              dateStyle: "medium",
              timeZone: "UTC",
            }).format(new Date(identity.createdAt))}
          </dd>
        </div>
      </dl>
    </section>
  );
}
