import { createServer } from "node:http";
import { loadEnvConfig } from "@next/env";
import next from "next";

const development = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "127.0.0.1";
const port = Number.parseInt(process.env.PORT ?? "3001", 10);
const internalShellHeader = "x-smarthire-internal-shell";
loadEnvConfig(process.cwd(), development);
const app = next({ dev: development, port });
const handle = app.getRequestHandler();

function expectedHost(origin: string | undefined, fallback: string) {
  return new URL(origin ?? fallback).host.toLowerCase();
}

function routeProductShell(request: Parameters<typeof handle>[0]) {
  delete request.headers[internalShellHeader];
  const host = request.headers.host?.toLowerCase() ?? "";
  const requestUrl = new URL(request.url ?? "/", `http://${host || "localhost"}`);
  const pathname = requestUrl.pathname;
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/admin-console" ||
    pathname.startsWith("/admin-console/") ||
    pathname === "/recruiter-entitlement" ||
    pathname.startsWith("/recruiter-entitlement/")
  )
    return;

  const adminHost = expectedHost(
    process.env.ADMIN_ORIGIN,
    "http://console.admin.localhost:3001",
  );
  const recruiterHost = expectedHost(
    process.env.RECRUITER_ORIGIN,
    "http://console.recruiter.localhost:3001",
  );
  const shell =
    host === adminHost
      ? { name: "admin", route: "/admin-console" }
      : host === recruiterHost
        ? { name: "recruiter", route: "/recruiter-entitlement" }
        : null;
  if (!shell) return;

  request.headers[internalShellHeader] = shell.name;
  request.url = `${shell.route}${pathname === "/" ? "" : pathname}${requestUrl.search}`;
}

async function start() {
  const { attachSocketIoChatGateway } = await import(
    "./src/backend/messaging/realtime/socket-io-chat-gateway"
  );
  await app.prepare();
  const server = createServer((request, response) => {
    routeProductShell(request);
    return handle(request, response);
  });
  const chat = attachSocketIoChatGateway(server);
  server.on("error", (error) => {
    console.error("SmartHire HTTP server failed", error);
    process.exitCode = 1;
  });
  server.listen(port, hostname, () => {
    console.info(`SmartHire ready at http://${hostname}:${port}`);
  });

  let closing = false;
  const close = () => {
    if (closing) return;
    closing = true;
    // Socket.IO owns the attached HTTP server lifecycle and closes it here.
    // Calling server.close() again can double-close native handles on Windows.
    chat.close(() => {
      void app.close().catch((error) => {
        console.error("SmartHire application shutdown failed", error);
        process.exitCode = 1;
      });
    });
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

void start().catch((error) => {
  console.error("SmartHire startup failed", error);
  process.exit(1);
});
