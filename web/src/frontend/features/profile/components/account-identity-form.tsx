"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { AccountIdentity } from "@/shared/contracts/account/identity";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import {
  UnsavedChangesIndicator,
  useUnsavedChangesGuard,
} from "../client/unsaved-changes";
import { Badge } from "@/frontend/components/ui/badge";
import { Button } from "@/frontend/components/ui/button";
import { Panel } from "@/frontend/components/ui/design-system";
import { InfoRow } from "@/frontend/components/ui/info-row";
import { TextField } from "@/frontend/components/ui/text-field";

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
    <Panel
      as="section"
      className="candidate-account-panel"
      aria-labelledby="identity-title"
      eyebrow={copy.kicker}
      title={copy.title}
      titleId="identity-title"
    >
      <UnsavedChangesIndicator dirty={isDirty} />
      <form
        className="candidate-account-panel__form"
        onSubmit={handleSubmit(async ({ name }) => {
          await onSave(name);
        })}
      >
        <TextField
          id="account-full-name"
          label={copy.fullName}
          maxLength={150}
          autoComplete="name"
          {...register("name")}
        />
        <Button fullWidth type="submit" disabled={saving || !isDirty}>
          {saving ? copy.saving : copy.save}
        </Button>
      </form>
      <dl className="candidate-account-panel__metadata">
        <InfoRow asDefinition label={copy.email} value={identity.email} />
        <InfoRow
          asDefinition
          label={copy.verification}
          value={
            <Badge tone={identity.emailVerified ? "teal" : "neutral"}>
              {identity.emailVerified ? copy.verified : copy.notVerified}
            </Badge>
          }
        />
        <InfoRow
          asDefinition
          label={copy.status}
          value={copy.active}
          valueTone="success"
        />
        <InfoRow
          asDefinition
          label={copy.created}
          value={new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en", {
            dateStyle: "medium",
            timeZone: "UTC",
          }).format(new Date(identity.createdAt))}
        />
      </dl>
    </Panel>
  );
}
