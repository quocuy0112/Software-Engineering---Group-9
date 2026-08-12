const hostname = "127.0.0.1";
const port = process.env.MESSAGING_SMOKE_PORT ?? "3011";
const baseUrl = `http://${hostname}:${port}`;

process.env.NODE_ENV = "production";
process.env.HOSTNAME = hostname;
process.env.PORT = port;

await import("../server.ts");

try {
  const deadline = Date.now() + 60_000;
  let healthStatus = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`, { cache: "no-store" });
      healthStatus = response.status;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  if (healthStatus === null) {
    throw new Error("Production custom server did not become reachable within 60 seconds.");
  }

  const socketRejection = await new Promise((resolve, reject) => {
    const socket = io(`${baseUrl}/chat`, {
      path: "/chat",
      transports: ["websocket"],
      reconnection: false,
      timeout: 5_000,
      extraHeaders: { origin: baseUrl },
    });
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("Socket.IO authentication gate did not respond."));
    }, 7_000);
    socket.once("connect", () => {
      clearTimeout(timeout);
      socket.close();
      reject(new Error("Unauthenticated Socket.IO client was accepted."));
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timeout);
      socket.close();
      resolve(error.message);
    });
  });

  console.info(
    JSON.stringify({
      baseUrl,
      healthStatus,
      unauthenticatedSocketRejectedWith: socketRejection,
      shutdown: "SIGTERM handler requested",
    }),
  );
} catch (error) {
  process.exitCode = 1;
  console.error(error);
} finally {
  process.emit("SIGTERM");
}
import { io } from "socket.io-client";
