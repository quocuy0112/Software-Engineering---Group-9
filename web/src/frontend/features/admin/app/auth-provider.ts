"use client";
import type { AuthProvider } from "react-admin";

let csrfToken: string | null = null;

async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  if (csrfToken && init.method && init.method !== "GET") {
    headers.set("x-csrf-token", csrfToken);
  }
  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw Object.assign(new Error(body.code ?? "UNAUTHORIZED"), {
      status: response.status,
    });
  if (typeof body.csrfToken === "string") csrfToken = body.csrfToken;
  return body;
}

export const adminAuthProvider: AuthProvider = {
  async login(params) {
    await request("/api/admin/auth/login", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },
  async logout() {
    try {
      await request("/api/admin/auth/logout", { method: "POST", body: "{}" });
    } finally {
      csrfToken = null;
    }
  },
  async checkAuth() {
    await request("/api/admin/auth/context");
  },
  async checkError(error) {
    const status = (error as { status?: number }).status;
    if (status === 401 || status === 403) {
      csrfToken = null;
      throw error;
    }
  },
  async getIdentity() {
    const context = await request("/api/admin/auth/context");
    return {
      id: context.accountId,
      fullName: context.displayName ?? "Administrator",
    };
  },
  async getPermissions() {
    await request("/api/admin/auth/context");
    return ["PLATFORM_ADMINISTRATOR"];
  },
};

export function currentAdminCsrfToken() {
  return csrfToken;
}
