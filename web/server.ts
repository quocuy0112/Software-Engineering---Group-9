import { createServer } from "node:http";
import { loadEnvConfig } from "@next/env";
import next from "next";

const development = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "127.0.0.1";
const port = Number.parseInt(process.env.PORT ?? "3001", 10);
loadEnvConfig(process.cwd(), development);
const app = next({ dev: development, hostname, port });
const handle = app.getRequestHandler();

async function start() {
  const { attachSocketIoChatGateway } = await import(
    "./src/backend/messaging/realtime/socket-io-chat-gateway"
  );
  await app.prepare();
  const server = createServer((request, response) => handle(request, response));
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
