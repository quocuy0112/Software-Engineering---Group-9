import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const clientPath = resolve(
  process.env.GOOGLE_DRIVE_BACKUP_CLIENT_PATH ??
    "../SmartHireBackup/client_secret_649331580707-cq8m0cp497p5a584bevi311n0ikn9b9h.apps.googleusercontent.com.json",
);
const tokenPath = resolve(
  process.env.GOOGLE_DRIVE_BACKUP_TOKEN_PATH ??
    "../SmartHireBackup/google-oauth-token.json",
);
const redirectUri = process.env.GOOGLE_DRIVE_BACKUP_REDIRECT_URI ??
  "http://127.0.0.1:3002/oauth2/callback";

const parsed = JSON.parse(await readFile(clientPath, "utf8"));
const client = parsed.web;
if (!client?.client_id || !client.client_secret) {
  throw new Error("GOOGLE_DRIVE_BACKUP_CLIENT_INVALID");
}

const redirect = new URL(redirectUri);
if (redirect.protocol !== "http:" || redirect.hostname !== "127.0.0.1") {
  throw new Error("GOOGLE_DRIVE_BACKUP_REDIRECT_MUST_BE_LOCALHOST");
}

const state = randomBytes(32).toString("hex");
const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authorizationUrl.search = new URLSearchParams({
  client_id: client.client_id,
  redirect_uri: redirectUri,
  response_type: "code",
  scope: "https://www.googleapis.com/auth/drive",
  access_type: "offline",
  prompt: "consent",
  state,
}).toString();

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? "/", redirectUri);
  if (requestUrl.pathname !== redirect.pathname) {
    response.writeHead(404).end();
    return;
  }
  if (requestUrl.searchParams.get("state") !== state) {
    response.writeHead(400).end("Google authorization state was rejected.");
    server.close();
    return;
  }
  const code = requestUrl.searchParams.get("code");
  if (!code) {
    response.writeHead(400).end("Google did not return an authorization code.");
    server.close();
    return;
  }
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: client.client_id,
        client_secret: client.client_secret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok || typeof token.refresh_token !== "string") {
      throw new Error("GOOGLE_DRIVE_BACKUP_REFRESH_TOKEN_MISSING");
    }
    await mkdir(dirname(tokenPath), { recursive: true, mode: 0o700 });
    await writeFile(
      tokenPath,
      JSON.stringify(
        {
          refresh_token: token.refresh_token,
          token_uri: "https://oauth2.googleapis.com/token",
          client_id: client.client_id,
          client_secret: client.client_secret,
          scopes: ["https://www.googleapis.com/auth/drive"],
        },
        null,
        2,
      ),
      { encoding: "utf8", mode: 0o600 },
    );
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end("Google Drive backup authorization completed. You can close this tab.");
    console.log(`Google Drive backup token created at ${tokenPath}`);
  } catch (error) {
    response.writeHead(500).end("Google Drive backup authorization failed.");
    console.error(error instanceof Error ? error.message : "GOOGLE_DRIVE_BACKUP_AUTH_FAILED");
  } finally {
    server.close();
  }
});

server.listen(Number(redirect.port), redirect.hostname, () => {
  console.log("Open this URL in the Google account that owns the SmartHire backup folder:");
  console.log(authorizationUrl.toString());
});
