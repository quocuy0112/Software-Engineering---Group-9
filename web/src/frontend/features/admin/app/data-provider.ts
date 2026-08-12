"use client";
import type { DataProvider, Identifier } from "react-admin";
import { currentAdminCsrfToken } from "./auth-provider";

const endpoints: Record<string, string> = {
  accounts: "/api/admin/accounts",
  companies: "/api/admin/companies",
  "company-memberships": "/api/admin/company-memberships",
  "verification-requests": "/api/admin/verification-requests",
  "moderation-reports": "/api/admin/moderation-reports",
  "support-cases": "/api/admin/support-cases",
};

async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  const csrf = currentAdminCsrfToken();
  if (csrf && init.method && init.method !== "GET")
    headers.set("x-csrf-token", csrf);
  const response = await fetch(path, {
    ...init,
    headers,
    cache: "no-store",
    credentials: "same-origin",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw Object.assign(new Error(body.code ?? "INTERNAL_FAILURE"), {
      status: response.status,
      body,
    });
  return body;
}

function endpoint(resource: string) {
  const value = endpoints[resource];
  if (!value) throw new Error("UNSUPPORTED_ADMIN_RESOURCE");
  return value;
}

const unsupported = async (): Promise<never> => {
  throw new Error("GENERIC_PRIVILEGED_CRUD_DISABLED");
};

export type AdminDataProvider = DataProvider & {
  command(
    path: string,
    input: unknown,
    version: number,
    idempotencyKey: string,
  ): Promise<unknown>;
  dashboard(): Promise<unknown>;
};

type ListParams = {
  pagination?: { page: number; perPage: number };
  sort?: { field: string; order: string };
  filter?: Record<string, unknown>;
  target?: string;
  id?: Identifier;
  ids?: Identifier[];
};

const closedProvider = {
  async getList(resource: string, params: ListParams) {
    const query = new URLSearchParams({
      page: String(params.pagination?.page ?? 1),
      perPage: String(params.pagination?.perPage ?? 25),
      sort: params.sort?.field ?? "createdAt",
      order: params.sort?.order ?? "DESC",
      filter: JSON.stringify(params.filter ?? {}),
    });
    const result = await api(`${endpoint(resource)}?${query}`);
    return {
      data: result.data,
      total: result.total,
      meta: {
        calculatedAt: result.calculatedAt,
        stateDefinitionVersion: result.stateDefinitionVersion,
      },
    };
  },
  async getOne(resource: string, params: { id: Identifier }) {
    const suffix = resource === "accounts" ? "/security" : "";
    const result = await api(
      `${endpoint(resource)}/${encodeURIComponent(String(params.id))}${suffix}`,
    );
    return { data: result.data };
  },
  async getMany(resource: string, params: { ids: Identifier[] }) {
    const result = await api(
      `${endpoint(resource)}?ids=${params.ids.map(String).join(",")}`,
    );
    return { data: result.data };
  },
  async getManyReference(
    resource: string,
    params: ListParams & { target: string; id: Identifier },
  ) {
    const query = new URLSearchParams({
      page: String(params.pagination?.page ?? 1),
      perPage: String(params.pagination?.perPage ?? 25),
      filter: JSON.stringify({
        ...(params.filter ?? {}),
        [params.target]: params.id,
      }),
    });
    const result = await api(`${endpoint(resource)}?${query}`);
    return { data: result.data, total: result.total };
  },
  create: unsupported,
  update: unsupported,
  updateMany: unsupported,
  delete: unsupported,
  deleteMany: unsupported,
  async command(
    path: string,
    input: unknown,
    version: number,
    idempotencyKey: string,
  ) {
    return api(path, {
      method: "POST",
      headers: {
        "if-match-version": String(version),
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify(input),
    });
  },
  dashboard: () => api("/api/admin/dashboard"),
} as unknown as AdminDataProvider;

export const adminDataProvider = closedProvider;

export function recordPath(resource: string, id: Identifier) {
  return `${endpoint(resource)}/${encodeURIComponent(String(id))}`;
}

export function accountCommandPath(
  accountId: Identifier,
  action: "suspend" | "reinstate" | "revoke-all" | "revoke-one",
  sessionReference?: string,
) {
  const base = `${endpoint("accounts")}/${encodeURIComponent(String(accountId))}`;
  return action === "revoke-all"
    ? `${base}/sessions/revoke-all`
    : action === "revoke-one" && sessionReference
      ? `${base}/sessions/${encodeURIComponent(sessionReference)}/revoke`
      : `${base}/${action}`;
}

export function membershipCommandPath(
  membershipId: Identifier,
  action: "suspend" | "restore" | "remove",
) {
  return `${endpoint("company-memberships")}/${encodeURIComponent(String(membershipId))}/${action}`;
}
