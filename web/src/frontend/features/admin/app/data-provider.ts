"use client";
import type { DataProvider, Identifier } from "react-admin";
import { currentAdminCsrfToken } from "./auth-provider";

const endpoints: Record<string, string> = {
  accounts: "/api/admin/accounts",
  companies: "/api/admin/companies",
  "company-memberships": "/api/admin/company-memberships",
  "verification-requests": "/api/admin/verification-requests",
  "moderation-reports": "/api/admin/moderation-reports",
  "messaging-reports": "/api/admin/messaging-reports",
  "support-cases": "/api/admin/support-cases",
  "professional-connection-proposals":
    "/api/admin/professional-connection-proposals",
};

export function adminApiErrorDetails(body: unknown) {
  if (!body || typeof body !== "object")
    return { code: "INTERNAL_FAILURE", message: "INTERNAL_FAILURE" };
  const envelope = body as {
    code?: unknown;
    error?: { code?: unknown; message?: unknown };
  };
  const code =
    typeof envelope.code === "string"
      ? envelope.code
      : typeof envelope.error?.code === "string"
        ? envelope.error.code
        : "INTERNAL_FAILURE";
  const message =
    typeof envelope.error?.message === "string" ? envelope.error.message : code;
  return { code, message };
}

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
  if (!response.ok) {
    const error = adminApiErrorDetails(body);
    throw Object.assign(new Error(error.message), {
      status: response.status,
      body,
      code: error.code,
    });
  }
  return body;
}

function endpoint(resource: string) {
  const value = endpoints[resource];
  if (!value) throw new Error("UNSUPPORTED_ADMIN_RESOURCE");
  return value;
}

function reactAdminRecord(resource: string, value: unknown) {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  if (typeof record.id === "string" || typeof record.id === "number")
    return value;

  const nestedKey =
    resource === "accounts"
      ? "account"
      : resource === "verification-requests"
        ? "request"
        : null;
  if (!nestedKey) return value;

  const nested = record[nestedKey];
  if (!nested || typeof nested !== "object") return value;
  const nestedRecord = nested as Record<string, unknown>;
  if (typeof nestedRecord.id !== "string" && typeof nestedRecord.id !== "number")
    return value;
  return { ...record, id: nestedRecord.id };
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
  signal?: AbortSignal;
};

const closedProvider = {
  async getList(resource: string, params: ListParams) {
    const page = params.pagination?.page ?? 1;
    const pageSize = params.pagination?.perPage ?? 25;
    const filter = params.filter ?? {};
    const query = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (resource === "accounts") {
      for (const key of [
        "q",
        "type",
        "status",
        "registeredFrom",
        "registeredTo",
      ]) {
        const value = filter[key];
        if (typeof value === "string" && value.trim())
          query.set(key, value.trim());
      }
    } else if (resource === "verification-requests") {
      for (const key of [
        "state",
        "applicantEligibility",
        "company",
        "taxCode",
        "submittedFrom",
        "submittedTo",
        "applicantId",
        "assignment",
      ]) {
        const value = filter[key];
        if (typeof value === "string" && value.trim())
          query.set(key, value.trim());
      }
    } else {
      query.set("perPage", String(pageSize));
      query.set("sort", params.sort?.field ?? "createdAt");
      query.set("order", params.sort?.order ?? "DESC");
      query.set("filter", JSON.stringify(filter));
    }
    const result = await api(`${endpoint(resource)}?${query}`, {
      signal: params.signal,
    });
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
    const result = await api(
      `${endpoint(resource)}/${encodeURIComponent(String(params.id))}`,
    );
    return { data: reactAdminRecord(resource, result.data ?? result) };
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
        "If-Match": `"${version}"`,
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
  action: "suspend" | "restore" | "revoke-all" | "revoke-one",
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
