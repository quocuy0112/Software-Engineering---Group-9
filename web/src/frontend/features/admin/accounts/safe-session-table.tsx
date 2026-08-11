"use client";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";

export type SafeSession = {
  reference: string;
  deviceDescription: string;
  approximateLocation: string | null;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
};
export function SafeSessionTable(props: {
  sessions: SafeSession[];
  onRevoke: (session: SafeSession) => void;
}) {
  return (
    <Table aria-label="Active login sessions">
      <TableHead>
        <TableRow>
          <TableCell>Device</TableCell>
          <TableCell>Approximate location</TableCell>
          <TableCell>Last active</TableCell>
          <TableCell>Expires</TableCell>
          <TableCell>Action</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {props.sessions.map((session) => (
          <TableRow key={session.reference}>
            <TableCell>{session.deviceDescription}</TableCell>
            <TableCell>
              {session.approximateLocation ?? "Unavailable"}
            </TableCell>
            <TableCell>
              {new Date(session.lastActivityAt).toLocaleString()}
            </TableCell>
            <TableCell>
              {new Date(session.expiresAt).toLocaleString()}
            </TableCell>
            <TableCell>
              <Button onClick={() => props.onRevoke(session)}>
                Revoke this session
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
