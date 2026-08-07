import { lstat } from "node:fs/promises";
import { request } from "node:http";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const expectedKeys = new Set(["status", "engine", "warmedAt"]);
const expectedEngineKeys = new Set([
  "name",
  "version",
  "runtimeName",
  "runtimeVersion",
  "modelName",
  "modelManifestSha256",
]);

function exactKeys(value, expected) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === expected.size &&
    Object.keys(value).every((key) => expected.has(key))
  );
}

function getJson(socketPath, path, timeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    const operation = request(
      {
        socketPath,
        path,
        method: "GET",
        headers: { accept: "application/json" },
      },
      (response) => {
        const chunks = [];
        let length = 0;
        response.on("data", (chunk) => {
          length += chunk.length;
          if (length > 16_384) {
            response.destroy(new Error("OCR_PROBE_RESPONSE_TOO_LARGE"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          if (response.statusCode !== 200) {
            reject(new Error("OCR_ENGINE_NOT_READY"));
            return;
          }
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            reject(new Error("OCR_PROBE_RESPONSE_INVALID"));
          }
        });
      },
    );
    operation.setTimeout(timeoutMs, () =>
      operation.destroy(new Error("OCR_PROBE_TIMEOUT")),
    );
    operation.once("error", reject);
    operation.end();
  });
}

export async function checkOcrEngine() {
  const socketPath = process.env.OCR_ENGINE_SOCKET_PATH ?? "";
  if (!isAbsolute(socketPath) || !socketPath.endsWith("/ocr.sock")) {
    throw new Error("OCR_ENGINE_SOCKET_PATH_INVALID");
  }
  const metadata = await lstat(socketPath);
  if (!metadata.isSocket()) throw new Error("OCR_ENGINE_SOCKET_INVALID");
  if (process.platform !== "win32" && (metadata.mode & 0o007) !== 0) {
    throw new Error("OCR_ENGINE_SOCKET_WORLD_ACCESSIBLE");
  }

  const body = await getJson(socketPath, "/health/ready");
  if (
    !exactKeys(body, expectedKeys) ||
    !exactKeys(body.engine, expectedEngineKeys)
  ) {
    throw new Error("OCR_ENGINE_READY_CONTRACT_INVALID");
  }
  const expected = {
    name: process.env.OCR_ENGINE_NAME,
    version: process.env.OCR_ENGINE_VERSION,
    runtimeName: "onnxruntime",
    runtimeVersion: "1.27.0",
    modelName: process.env.OCR_MODEL_NAME,
    modelManifestSha256: process.env.OCR_MODEL_SHA256,
  };
  if (
    body.status !== "ready" ||
    !Number.isFinite(Date.parse(body.warmedAt)) ||
    Object.entries(expected).some(
      ([key, value]) => !value || body.engine[key] !== value,
    )
  ) {
    throw new Error("OCR_ENGINE_MANIFEST_MISMATCH");
  }
  return Object.freeze({ status: "ready" });
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  await checkOcrEngine();
  console.log("OCR engine readiness and pinned manifest probe passed.");
}
