"use client";
import type { AuthProvider } from "react-admin";

let csrfToken: string | null = null;
type AdminAuthContext = {
  accountId: string;
  displayName?: string;
  csrfToken?: string;
};
let contextRequest: Promise<AdminAuthContext> | null = null;

function statusOf(error: unknown) {
  return (error as { status?: number } | null)?.status;
}

function errorCodeOf(error: unknown) {
  const value = error as {
    code?: unknown;
    body?: { code?: unknown; error?: { code?: unknown } };
  } | null;
  if (typeof value?.code === "string") return value.code;
  if (typeof value?.body?.code === "string") return value.body.code;
  return typeof value?.body?.error?.code === "string"
    ? value.body.error.code
    : undefined;
}

function isSignedOutError(error: unknown) {
  const status = statusOf(error);
  return (
    status === 401 || (status === 403 && errorCodeOf(error) === "UNAUTHORIZED")
  );
}

function clearAuthState() {
  csrfToken = null;
  contextRequest = null;
}

async function request<
  T extends Record<string, unknown> = Record<string, unknown>,
>(path: string, init: RequestInit = {}): Promise<T> {
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
  const body = (await response.json().catch(() => ({}))) as T & {
    code?: string;
    csrfToken?: string;
  };
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) clearAuthState();
    throw Object.assign(new Error(body.code ?? "UNAUTHORIZED"), {
      status: response.status,
    });
  }
  if (typeof body.csrfToken === "string") csrfToken = body.csrfToken;
  return body;
}

function loadContext() {
  if (!contextRequest) {
    contextRequest = request<AdminAuthContext>(
      "/api/admin/auth/context",
    ).finally(() => {
      contextRequest = null;
    });
  }
  return contextRequest;
}

export const adminAuthProvider: AuthProvider = {
  async login(params) {
    clearAuthState();
    await request("/api/admin/auth/login", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },
  async logout() {
    // React Admin calls logout after a rejected checkAuth. In that state there
    // is no authorized admin context (and therefore no CSRF proof) to revoke.
    // Treat logout as idempotent and never turn an expected 401 into an
    // unhandled rejection loop.
    try {
      if (csrfToken)
        await request("/api/admin/auth/logout", {
          method: "POST",
          body: "{}",
        });
    } catch (error) {
      if (!isSignedOutError(error)) throw error;
    } finally {
      clearAuthState();
    }
  },
  async checkAuth() {
    await loadContext();
  },
  async checkError(error) {
    if (isSignedOutError(error)) {
      clearAuthState();
      throw error;
    }
  },
  async getIdentity() {
    const context = await loadContext();
    return {
      id: context.accountId,
      fullName: context.displayName ?? "Administrator",
    };
  },
  async getPermissions() {
    try {
      await loadContext();
      return ["PLATFORM_ADMINISTRATOR"];
    } catch (error) {
      if (isSignedOutError(error)) return [];
      throw error;
    }
  },
};

export function currentAdminCsrfToken() {
  return csrfToken;
}
