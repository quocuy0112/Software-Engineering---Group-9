import { request } from "node:http";

const hostname = "127.0.0.1";
const port = process.env.DEVELOPMENT_SMOKE_PORT ?? "3011";
const baseUrl = `http://${hostname}:${port}`;

process.env.NODE_ENV = "development";
process.env.HOSTNAME = hostname;
process.env.PORT = port;
process.env.CANDIDATE_ORIGIN = `http://localhost:${port}`;
process.env.ADMIN_ORIGIN = `http://console.admin.localhost:${port}`;
process.env.RECRUITER_ORIGIN = `http://console.recruiter.localhost:${port}`;

const { start } = await import("../server.ts");
const server = await start();

async function waitForServer() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        cache: "no-store",
      });
      if (response.status < 500) return response.status;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw new Error("Development custom server did not become healthy within 60 seconds.");
}

function requestRoute(path, host) {
  return new Promise((resolveRequest, rejectRequest) => {
    const pendingRequest = request(
      { hostname, port, path, headers: { host } },
      (response) => {
        response.resume();
        response.once("end", () => resolveRequest(response.statusCode ?? 0));
      },
    );
    pendingRequest.once("error", rejectRequest);
    pendingRequest.end();
  });
}

try {
  const healthStatus = await waitForServer();
  const routes = [
    {
      host: `console.admin.localhost:${port}`,
      path: "/",
      name: "admin-console",
    },
    {
      host: `localhost:${port}`,
      path: "/dashboard/employer-verification",
      name: "employer-verification",
    },
  ];
  const routeStatuses = {};

  for (const route of routes) {
    const status = await requestRoute(route.path, route.host);
    routeStatuses[route.name] = status;
    if (status >= 500) {
      throw new Error(`${route.name} returned ${status}`);
    }
  }

  console.info(JSON.stringify({ baseUrl, healthStatus, routeStatuses }));
} catch (error) {
  process.exitCode = 1;
  console.error(error);
} finally {
  await server.close();
}

process.exit(process.exitCode ?? 0);
