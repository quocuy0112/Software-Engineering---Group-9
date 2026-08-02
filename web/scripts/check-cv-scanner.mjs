import { readFile, stat } from "node:fs/promises";
import { createConnection } from "node:net";
import { pathToFileURL } from "node:url";

const EXPECTED_SOCKET_PATH = "/run/clamav/clamd.sock";
const EXPECTED_SOCKET_UID = 100;
const EXPECTED_SOCKET_GID = 101;
const EXPECTED_SOCKET_MODE = 0o660;
const MAX_SIGNATURE_AGE_HOURS = 24;
const FORBIDDEN_TCP_PORTS = new Set([3310, 7357]);

const fail = (message) => {
  throw new Error(`CV scanner readiness failed: ${message}`);
};

export function validateCvScannerSocketMetadata(metadata, workerGroups = []) {
  if (!metadata.isSocket()) fail("configured path is not a Unix socket");
  if (
    metadata.uid !== EXPECTED_SOCKET_UID ||
    metadata.gid !== EXPECTED_SOCKET_GID
  ) {
    fail("Unix socket owner/group does not match the reviewed image contract");
  }
  if ((metadata.mode & 0o777) !== EXPECTED_SOCKET_MODE) {
    fail("Unix socket mode must be exactly 0660");
  }
  if (!workerGroups.includes(EXPECTED_SOCKET_GID)) {
    fail("worker process is not a member of the shared scanner group");
  }
}

export function validateCvScannerVersion(version, now = new Date()) {
  const versionParts = version.split("/");
  if (!/^ClamAV 1[.]4[.]5$/.test(versionParts[0] ?? "")) {
    fail("clamd engine version differs from the reviewed 1.4.5 release");
  }
  const signatureTimestamp = Date.parse(versionParts.slice(2).join("/"));
  const signatureAgeMs = now.getTime() - signatureTimestamp;
  if (
    !Number.isFinite(signatureTimestamp) ||
    signatureAgeMs < 0 ||
    signatureAgeMs > MAX_SIGNATURE_AGE_HOURS * 60 * 60 * 1_000
  ) {
    fail("signature database is missing, future-dated, or older than 24 hours");
  }
}

const sendClamdCommand = (socketPath, command, timeoutMs = 5_000) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    const socket = createConnection({ path: socketPath });
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("clamd command timed out"));
    }, timeoutMs);

    socket.on("connect", () => socket.write(`z${command}\0`));
    socket.on("data", (chunk) => {
      chunks.push(chunk);
      if (chunk.includes(0)) socket.end();
    });
    socket.on("error", reject);
    socket.on("close", () => {
      clearTimeout(timeout);
      resolve(Buffer.concat(chunks).toString("utf8").replace(/\0+$/, ""));
    });
  });

const parseListeningPorts = async (path) => {
  const contents = await readFile(path, "utf8").catch(() => "");
  return contents
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter((fields) => fields.length >= 4 && fields[3] === "0A")
    .map((fields) => Number.parseInt(fields[1].split(":").at(-1), 16));
};

export async function checkCvScanner({ now = new Date() } = {}) {
  const socketPath = process.env.CV_CLAMD_SOCKET_PATH;
  if (socketPath !== EXPECTED_SOCKET_PATH) {
    fail("only the reviewed Unix socket path is allowed");
  }
  if (
    Object.keys(process.env).some((key) =>
      /^CV_CLAMD_(?:HOST|PORT|TCP|ADDR|ADDRESS)$/i.test(key),
    )
  ) {
    fail("TCP scanner configuration is forbidden");
  }

  const socketMetadata = await stat(socketPath);
  validateCvScannerSocketMetadata(
    socketMetadata,
    typeof process.getgroups === "function"
      ? process.getgroups()
      : [EXPECTED_SOCKET_GID],
  );

  const pong = await sendClamdCommand(socketPath, "PING");
  if (pong !== "PONG") fail("clamd did not respond to PING");

  const version = await sendClamdCommand(socketPath, "VERSION");
  validateCvScannerVersion(version, now);

  const listeningPorts = [
    ...(await parseListeningPorts("/proc/net/tcp")),
    ...(await parseListeningPorts("/proc/net/tcp6")),
  ];
  if (listeningPorts.some((port) => FORBIDDEN_TCP_PORTS.has(port))) {
    fail("scanner TCP listener is present");
  }

  return { engine: "1.4.5", transport: "unix", signatureFresh: true };
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectExecution) {
  await checkCvScanner();
  console.log("CV scanner readiness passed using the private Unix socket.");
}
