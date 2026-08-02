"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  revokeSessionMutationOptions,
  sessionListQueryOptions,
} from "@/frontend/features/authentication/client/query-options";
import { AuthStatus } from "@/frontend/features/authentication/components/auth-status";
import { AppProviders } from "@/frontend/providers/app-providers";
import { Badge } from "@/frontend/components/ui/badge";
import { Button } from "@/frontend/components/ui/button";
import { EmptyState } from "@/frontend/components/ui/empty-state";
import { Modal } from "@/frontend/components/ui/modal";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";

export function SessionList({ embedded = false }: { embedded?: boolean }) {
  return (
    <AppProviders>
      <SessionListContent embedded={embedded} />
    </AppProviders>
  );
}

function SessionListContent({ embedded = false }: { embedded?: boolean }) {
  const locale = useWorkspaceLocale();
  const copy =
    locale === "vi"
      ? {
          loading: "Đang tải các phiên đăng nhập.",
          loadError: "Không thể tải các phiên đăng nhập.",
          revoked: "Đã thu hồi phiên đăng nhập.",
          revokeError: "Không thể thu hồi phiên đăng nhập.",
          kicker: "TRUY CẬP ĐANG HOẠT ĐỘNG",
          title: "Phiên đăng nhập",
          subtitle:
            "Kiểm tra các thiết bị hiện có thể truy cập tài khoản SmartHire của bạn.",
          active: "đang hoạt động",
          devicesKicker: "THIẾT BỊ ĐÃ ĐĂNG NHẬP",
          devices: "Thiết bị đã đăng nhập",
          devicesHint: "Thu hồi quyền truy cập của thiết bị bạn không nhận ra.",
          current: "hiện tại",
          lastActive: "Hoạt động gần nhất",
          revoke: "Thu hồi phiên",
          revokeTitle: "Thu hồi phiên đăng nhập?",
          revokeDescription:
            "Thiết bị này sẽ phải đăng nhập lại để tiếp tục truy cập SmartHire.",
          cancel: "Hủy",
          confirmRevoke: "Thu hồi phiên",
          revoking: "Đang thu hồi…",
          emptyTitle: "Không có phiên đang hoạt động",
          emptyCopy: "Không có phiên đăng nhập nào để hiển thị.",
        }
      : {
          loading: "Loading sessions.",
          loadError: "Unable to load sessions.",
          revoked: "Session revoked.",
          revokeError: "Unable to revoke session.",
          kicker: "ACTIVE ACCESS",
          title: "Sessions",
          subtitle:
            "Review the devices that can currently access your SmartHire account.",
          active: "active",
          devicesKicker: "SIGNED-IN DEVICES",
          devices: "Signed-in devices",
          devicesHint: "Revoke any device you do not recognize.",
          current: "current",
          lastActive: "Last active",
          revoke: "Revoke session",
          revokeTitle: "Revoke this session?",
          revokeDescription:
            "This device will need to sign in again before it can access SmartHire.",
          cancel: "Cancel",
          confirmRevoke: "Revoke session",
          revoking: "Revoking…",
          emptyTitle: "No active sessions",
          emptyCopy: "No active sessions are available to display.",
        };
  const [proof, setProof] = useState("");
  const [sessionToRevoke, setSessionToRevoke] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const sessionsQuery = useQuery(sessionListQueryOptions(setProof));
  const revokeMutation = useMutation({
    ...revokeSessionMutationOptions(proof),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["identity", "sessions"],
      });
    },
  });
  const sessions = sessionsQuery.data ?? [];
  const status = sessionsQuery.isPending
    ? copy.loading
    : sessionsQuery.isError
      ? copy.loadError
      : revokeMutation.isSuccess
        ? copy.revoked
        : revokeMutation.isError
          ? copy.revokeError
          : "";
  const statusTone =
    sessionsQuery.isError || revokeMutation.isError
      ? "error"
      : sessionsQuery.isSuccess || revokeMutation.isSuccess
        ? "success"
        : "message";

  return (
    <section
      className={
        embedded ? "sessions-page sessions-page--embedded" : "sessions-page"
      }
    >
      {!embedded ? (
        <header className="page-heading">
          <div>
            <p className="workspace-kicker">{copy.kicker}</p>
            <h1 id="workspace-page-title">{copy.title}</h1>
            <p className="page-heading-copy">{copy.subtitle}</p>
          </div>
          <Badge className="page-heading-badge" tone="info">
            {sessions.length} {copy.active}
          </Badge>
        </header>
      ) : null}
      <AuthStatus
        id="session-list-status"
        status={status}
        tone={statusTone}
        toastOnChange={false}
      />
      <div className="sessions-panel-heading">
        <div>
          <p className="panel-kicker">{copy.devicesKicker}</p>
          <h2>{copy.devices}</h2>
        </div>
        <p>{copy.devicesHint}</p>
      </div>
      <ul className="session-list">
        {sessions.map((session) => (
          <li className="session-item" key={session.reference}>
            <span className="session-device-icon" aria-hidden="true">
              □
            </span>
            <div className="session-details">
              <strong>
                {session.device}
                {session.current ? ` (${copy.current})` : ""}
              </strong>
              <p>
                {session.approximateLocation} · {copy.lastActive}{" "}
                {new Date(session.lastActiveAt).toLocaleString(
                  locale === "vi" ? "vi-VN" : "en",
                )}
              </p>
            </div>
            {!session.current ? (
              <button
                className="session-revoke-button"
                type="button"
                onClick={() => setSessionToRevoke(session.reference)}
                disabled={revokeMutation.isPending}
              >
                {copy.revoke}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {!sessionsQuery.isPending && sessions.length === 0 ? (
        <EmptyState
          className="session-empty"
          icon="□"
          title={copy.emptyTitle}
          description={copy.emptyCopy}
        />
      ) : null}
      <Modal
        open={sessionToRevoke !== null}
        title={copy.revokeTitle}
        description={copy.revokeDescription}
        tone="destructive"
        busy={revokeMutation.isPending}
        onClose={() => setSessionToRevoke(null)}
      >
        <div className="sh-modal-actions">
          <Button
            variant="secondary"
            disabled={revokeMutation.isPending}
            onClick={() => setSessionToRevoke(null)}
          >
            {copy.cancel}
          </Button>
          <Button
            data-autofocus
            variant="danger"
            disabled={revokeMutation.isPending}
            onClick={() => {
              if (!sessionToRevoke) return;
              revokeMutation.mutate(sessionToRevoke, {
                onSuccess: () => setSessionToRevoke(null),
              });
            }}
          >
            {revokeMutation.isPending ? copy.revoking : copy.confirmRevoke}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
