"use client";
import { AccountStateDialog } from "./account-state-dialog";
export function SessionRevocationDialog(props: {
  open: boolean;
  targetLabel: string;
  onClose: () => void;
  onConfirm: (value: {
    reasonCategory: string;
    explanation: string;
    confirmation: true;
  }) => Promise<boolean | void>;
}) {
  return (
    <AccountStateDialog
      {...props}
      title={`Revoke ${props.targetLabel}`}
      actionLabel="Revoke session"
    />
  );
}
