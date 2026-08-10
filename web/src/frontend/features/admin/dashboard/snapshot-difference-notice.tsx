"use client";
import { Alert } from "@mui/material";
import { useListContext } from "react-admin";

export function SnapshotDifferenceNotice(props: {
  snapshotTotal?: number;
  currentTotal?: number;
  snapshotAt?: string;
  currentAt?: string;
}) {
  if (
    props.snapshotTotal === undefined ||
    props.currentTotal === undefined ||
    props.snapshotTotal === props.currentTotal
  )
    return null;
  return (
    <Alert severity="info">
      Source data changed after the dashboard snapshot. Dashboard calculated{" "}
      {props.snapshotAt}; this list calculated {props.currentAt}.
    </Alert>
  );
}

export function CurrentListSnapshotDifference() {
  const { total, meta } = useListContext();
  const query =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search);
  const sourceCount = query?.get("sourceCount");
  const sourceAt = query?.get("sourceAt") ?? undefined;
  return (
    <SnapshotDifferenceNotice
      snapshotTotal={
        sourceCount === null || sourceCount === undefined
          ? undefined
          : Number(sourceCount)
      }
      currentTotal={total}
      snapshotAt={sourceAt}
      currentAt={(meta as { calculatedAt?: string } | undefined)?.calculatedAt}
    />
  );
}
