"use client";
import { useEffect, useState } from "react";
import type { PublicSession } from "@/features/identity/schemas/session";

export function SessionList() {
  const [sessions, setSessions] = useState<PublicSession[]>([]),
    [proof, setProof] = useState(""),
    [status, setStatus] = useState("Loading sessions.");
  async function load(signal?: AbortSignal) {
    const response = await fetch("/api/identity/sessions", {
      cache: "no-store",
      signal,
    });
    if (!response.ok) {
      setStatus("Unable to load sessions.");
      return;
    }
    const body = (await response.json()) as {
      sessions: PublicSession[];
      csrfProof: string;
    };
    setSessions(body.sessions);
    setProof(body.csrfProof);
    setStatus("");
  }
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => void load(controller.signal), 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);
  async function revoke(reference: string) {
    const response = await fetch(`/api/identity/sessions/${reference}`, {
      method: "DELETE",
      headers: { "x-csrf-token": proof },
    });
    setStatus(response.ok ? "Session revoked." : "Unable to revoke session.");
    if (response.ok) await load();
  }
  return (
    <section>
      <h1>Sessions</h1>
      <p role="status">{status}</p>
      <ul>
        {sessions.map((session) => (
          <li key={session.reference}>
            <strong>
              {session.device}
              {session.current ? " (current)" : ""}
            </strong>
            <p>
              {session.approximateLocation} · Last active{" "}
              {new Date(session.lastActiveAt).toLocaleString()}
            </p>
            {!session.current ? (
              <button
                type="button"
                onClick={() => void revoke(session.reference)}
              >
                Revoke session
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
