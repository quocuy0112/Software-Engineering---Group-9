import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import os from "node:os";
import { resolve } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { config as loadEnvironment } from "dotenv";
import { Client } from "pg";

const webRoot = process.cwd();
loadEnvironment({ path: resolve(webRoot, ".env.local"), quiet: true });

const baseUrl = process.env.PERF_BASE_URL ?? "http://localhost:3001";
const iterations = Number.parseInt(process.env.PERF_ITERATIONS ?? "100", 10);
const viewBudgetMs = 3_000;
const mutationBudgetMs = 2_000;
const revocationBudgetMs = 2_000;
const shutdownTimeoutMs = 5_000;

if (!Number.isInteger(iterations) || iterations < 2) {
  throw new Error("PERF_ITERATIONS must be an integer greater than one");
}
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}
if (!process.env.npm_execpath) {
  throw new Error("npm_execpath is required");
}

function percentile(sorted, fraction) {
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
  ];
}

function summarize(name, timings, budgetMs) {
  const sorted = [...timings].sort((left, right) => left - right);
  const result = {
    name,
    samples: sorted.length,
    p50Ms: Number(percentile(sorted, 0.5).toFixed(2)),
    p95Ms: Number(percentile(sorted, 0.95).toFixed(2)),
    maxMs: Number(sorted.at(-1).toFixed(2)),
    budgetMs,
  };
  return { ...result, passed: result.p95Ms <= budgetMs };
}

async function waitUntil(predicate, timeoutMs, label) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if (await predicate()) return;
    await delay(10);
  }
  throw new Error(`${label} timed out after ${timeoutMs}ms`);
}

async function assertServerPortIsFree() {
  try {
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(750) });
    if (response) throw new Error(`PERF_BASE_URL_ALREADY_IN_USE:${baseUrl}`);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("PERF_BASE_URL_ALREADY_IN_USE")
    ) {
      throw error;
    }
  }
}

function startProductionServer() {
  return spawn(process.execPath, [process.env.npm_execpath, "run", "start"], {
    cwd: webRoot,
    env: { ...process.env, EMAIL_ADAPTER: "capture" },
    stdio: "inherit",
    windowsHide: true,
    detached: process.platform !== "win32",
  });
}

async function waitForServer(server) {
  const deadline = performance.now() + 60_000;
  while (performance.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`PERFORMANCE_SERVER_EXITED:${server.exitCode}`);
    }
    try {
      const response = await fetch(baseUrl, {
        redirect: "manual",
        signal: AbortSignal.timeout(1_000),
      });
      if (response.status > 0) return;
    } catch {
      // The production process is still starting.
    }
    await delay(250);
  }
  throw new Error("PERFORMANCE_SERVER_START_TIMEOUT");
}

function waitForExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }
  return new Promise((resolveExit) => child.once("exit", resolveExit));
}

function taskkill(pid, force) {
  return new Promise((resolveExit) => {
    const args = ["/PID", String(pid), "/T"];
    if (force) args.push("/F");
    const killer = spawn("taskkill.exe", args, {
      stdio: "ignore",
      windowsHide: true,
    });
    killer.once("error", resolveExit);
    killer.once("exit", resolveExit);
  });
}

async function stopProductionServer(server) {
  if (
    !server ||
    server.exitCode !== null ||
    server.signalCode !== null ||
    !server.pid
  ) {
    return;
  }

  if (process.platform === "win32") {
    await taskkill(server.pid, false);
  } else {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "ESRCH"
      ) {
        throw error;
      }
    }
  }

  const exited = await Promise.race([
    waitForExit(server).then(() => true),
    delay(shutdownTimeoutMs).then(() => false),
  ]);
  if (!exited) {
    if (process.platform === "win32") {
      await taskkill(server.pid, true);
    } else {
      try {
        process.kill(-server.pid, "SIGKILL");
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !("code" in error) ||
          error.code !== "ESRCH"
        ) {
          throw error;
        }
      }
    }
    await waitForExit(server);
  }
}

async function seedMaximumAccount(client) {
  const runLabel = randomUUID().replaceAll("-", "").slice(0, 16);
  const userId = randomUUID();
  const profileId = randomUUID();
  const email = `profile-performance-${runLabel}@example.test`;
  const password = `Profile performance ${runLabel}!`;
  const passwordDigest = await hashPassword(password);
  const now = new Date();
  const skillPrefix = `performance-${runLabel}-skill`;

  await client.query("BEGIN");
  try {
    await client.query(
      `INSERT INTO "user"
        ("id", "name", "email", "normalizedEmail", "emailVerified", "state",
         "stateChangedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $3, true, 'ACTIVE', $4, $4, $4)`,
      [userId, "Maximum Profile Candidate", email, now],
    );
    await client.query(
      `INSERT INTO "account"
        ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
       VALUES ($1, $2, 'credential', $2, $3, $4, $4)`,
      [randomUUID(), userId, passwordDigest, now],
    );
    await client.query(
      `INSERT INTO "CandidateIdentity" ("userId", "createdAt", "updatedAt")
       VALUES ($1, $2, $2)`,
      [userId, now],
    );
    await client.query(
      `INSERT INTO "CandidateProfile"
        ("id", "candidateUserId", "headline", "summary", "phone", "location",
         "revision", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $7)`,
      [
        profileId,
        userId,
        "Principal software engineer",
        "A maximum-size profile used for repeatable local performance evidence.",
        "+84 912 345 678",
        "Ho Chi Minh City",
        now,
      ],
    );

    for (let index = 0; index < 50; index += 1) {
      const position = index;
      const number = String(index + 1).padStart(2, "0");
      const skillId = randomUUID();
      const displayName = `Performance Skill ${number}`;
      const normalizedName = `${skillPrefix}-${number}`;
      await client.query(
        `INSERT INTO "Skill"
          ("id", "name", "normalizedName", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $4)`,
        [skillId, displayName, normalizedName, now],
      );
      await client.query(
        `INSERT INTO "CandidateProfileSkill"
          ("profileId", "skillId", "displayName", "position", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $5)`,
        [profileId, skillId, displayName, position, now],
      );
      await client.query(
        `INSERT INTO "ProfileExperience"
          ("id", "profileId", "title", "company", "description", "startDate",
           "endDate", "isCurrent", "position", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, $9, $9)`,
        [
          randomUUID(),
          profileId,
          `Engineer ${number}`,
          `Company ${number}`,
          `Measured experience entry ${number}.`,
          `2000-01-${String((index % 28) + 1).padStart(2, "0")}`,
          `2001-01-${String((index % 28) + 1).padStart(2, "0")}`,
          position,
          now,
        ],
      );
      await client.query(
        `INSERT INTO "ProfileEducation"
          ("id", "profileId", "institution", "degree", "field", "startDate",
           "endDate", "isCurrent", "position", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, $9, $9)`,
        [
          randomUUID(),
          profileId,
          `Institution ${number}`,
          `Degree ${number}`,
          `Field ${number}`,
          `1995-01-${String((index % 28) + 1).padStart(2, "0")}`,
          `1999-01-${String((index % 28) + 1).padStart(2, "0")}`,
          position,
          now,
        ],
      );
    }

    for (let index = 0; index < 10; index += 1) {
      const url = `https://example.test/${runLabel}/profile-${index + 1}`;
      await client.query(
        `INSERT INTO "SocialLink"
          ("id", "profileId", "url", "normalizedUrl", "position", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $3, $4, $5, $5)`,
        [randomUUID(), profileId, url, index, now],
      );
    }

    await client.query(
      `INSERT INTO "AccountPreferences"
        ("userId", "language", "timezone", "applicationUpdatesEmail",
         "jobRecommendationsEmail", "accountSecurityEmail", "createdAt", "updatedAt")
       VALUES ($1, 'EN', 'Asia/Ho_Chi_Minh', true, true, true, $2, $2)`,
      [userId, now],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  return { userId, profileId, email, password, skillPrefix };
}

async function cleanupMaximumAccount(client, fixture) {
  if (!fixture) return;
  await client.query("BEGIN");
  try {
    await client.query(
      `DELETE FROM "PasswordChangeOperation" WHERE "userId" = $1`,
      [fixture.userId],
    );
    await client.query(`DELETE FROM "CandidateIdentity" WHERE "userId" = $1`, [
      fixture.userId,
    ]);
    await client.query(`DELETE FROM "user" WHERE "id" = $1`, [fixture.userId]);
    await client.query(
      `DELETE FROM "Skill"
       WHERE "normalizedName" LIKE $1
         AND NOT EXISTS (
           SELECT 1 FROM "CandidateProfileSkill" selected
           WHERE selected."skillId" = "Skill"."id"
         )`,
      [`${fixture.skillPrefix}%`],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function signIn(browser, email, password) {
  const context = await browser.newContext({
    baseURL: baseUrl,
    reducedMotion: "reduce",
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/identity/login") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sign in" }).click();
  const response = await responsePromise;
  if (response.status() !== 200) {
    throw new Error(`PERFORMANCE_LOGIN_FAILED:${response.status()}`);
  }
  await page.waitForURL(/\/dashboard$/u);
  await page.getByRole("heading", { name: "Dashboard" }).waitFor();
  return { context, page };
}

async function assertMaximumProfile(page) {
  const response = await page.request.get("/api/account/profile");
  if (response.status() !== 200) {
    throw new Error(`MAXIMUM_PROFILE_READ_FAILED:${response.status()}`);
  }
  const profile = await response.json();
  const counts = {
    skills: profile.skills?.length,
    experience: profile.experience?.length,
    education: profile.education?.length,
    socialLinks: profile.socialLinks?.length,
  };
  if (
    counts.skills !== 50 ||
    counts.experience !== 50 ||
    counts.education !== 50 ||
    counts.socialLinks !== 10
  ) {
    throw new Error(
      `MAXIMUM_PROFILE_DATASET_INVALID:${JSON.stringify(counts)}`,
    );
  }
  return counts;
}

async function measureSamples(action) {
  await action(-1);
  const timings = [];
  for (let index = 0; index < iterations; index += 1) {
    timings.push(await action(index));
  }
  return timings;
}

async function waitForProfile(page) {
  await page
    .getByRole("heading", { name: "Professional profile", exact: true })
    .waitFor();
  await page.getByLabel("Skill 50", { exact: true }).waitFor();
  await page.getByRole("group", { name: "Experience 50" }).waitFor();
  await page.getByRole("group", { name: "Education 50" }).waitFor();
  await page.getByLabel("Social link 10", { exact: true }).waitFor();
}

async function measureViewLoads(page) {
  const views = [
    {
      name: "professional-profile",
      route: "/profile",
      ready: () => waitForProfile(page),
    },
    {
      name: "account-identity",
      route: "/profile/account",
      ready: () =>
        page
          .getByRole("heading", { name: "Account identity", exact: true })
          .waitFor(),
    },
    {
      name: "account-preferences",
      route: "/profile/preferences",
      ready: () =>
        page
          .getByRole("heading", { name: "Preferences", exact: true })
          .waitFor(),
    },
    {
      name: "account-security",
      route: "/profile/security",
      ready: async () => {
        await page
          .getByRole("heading", { name: "Security", exact: true })
          .waitFor();
        await page.getByRole("region", { name: "Change password" }).waitFor();
      },
    },
  ];

  const results = [];
  for (const view of views) {
    const timings = await measureSamples(async () => {
      const startedAt = performance.now();
      await page.goto(view.route, { waitUntil: "domcontentloaded" });
      await view.ready();
      return performance.now() - startedAt;
    });
    results.push(summarize(view.name, timings, viewBudgetMs));
  }
  return results;
}

async function measureProfileSaves(page) {
  await page.goto("/profile");
  await waitForProfile(page);
  const headline = page.getByLabel("Headline");
  const button = page.getByRole("button", { name: "Save basics" });
  const revisionBadge = page.locator(".page-heading-badge");
  const feedback = page
    .getByRole("region", { name: "Save feedback" })
    .getByRole("status");

  return measureSamples(async (index) => {
    const currentRevision = Number.parseInt(
      (await revisionBadge.textContent())?.match(/\d+/u)?.[0] ?? "-1",
      10,
    );
    if (currentRevision < 0) throw new Error("PROFILE_REVISION_UNAVAILABLE");
    await headline.fill(`Measured profile save ${index % 2 === 0 ? "A" : "B"}`);
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/account/profile") &&
        response.request().method() === "PATCH",
    );
    const startedAt = performance.now();
    await button.click();
    const response = await responsePromise;
    if (response.status() !== 200) {
      throw new Error(`PROFILE_PERFORMANCE_SAVE_FAILED:${response.status()}`);
    }
    await page
      .getByText(`Revision ${currentRevision + 1}`, { exact: true })
      .waitFor();
    await feedback.waitFor();
    await waitUntil(() => button.isEnabled(), mutationBudgetMs, "profile save");
    return performance.now() - startedAt;
  });
}

async function measureIdentitySaves(page) {
  await page.goto("/profile/account");
  await page
    .getByRole("heading", { name: "Account identity", exact: true })
    .waitFor();
  const name = page.getByLabel("Full name", { exact: true });
  const button = page.getByRole("button", { name: "Save full name" });
  const feedback = page
    .getByRole("region", { name: "Account feedback" })
    .getByRole("status");

  return measureSamples(async (index) => {
    const expectedName = `Maximum Profile Candidate ${index % 2 === 0 ? "A" : "B"}`;
    await name.fill(expectedName);
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/account/identity") &&
        response.request().method() === "PATCH",
    );
    const startedAt = performance.now();
    await button.click();
    const response = await responsePromise;
    if (response.status() !== 200) {
      throw new Error(`IDENTITY_PERFORMANCE_SAVE_FAILED:${response.status()}`);
    }
    await feedback.waitFor();
    await waitUntil(
      () => button.isEnabled(),
      mutationBudgetMs,
      "identity save",
    );
    if ((await name.inputValue()) !== expectedName) {
      throw new Error("IDENTITY_AUTHORITATIVE_VALUE_MISMATCH");
    }
    return performance.now() - startedAt;
  });
}

async function measurePreferenceSaves(page) {
  await page.goto("/profile/preferences");
  const panel = page.getByRole("region", { name: "Account preferences" });
  await panel.waitFor();
  const language = panel.getByLabel("Language");
  const timezone = panel.getByLabel("Timezone");
  const button = panel.getByRole("button", { name: "Save preferences" });
  const feedback = panel.getByRole("status");

  return measureSamples(async (index) => {
    const expectedLanguage = index % 2 === 0 ? "vi" : "en";
    const expectedTimezone = index % 2 === 0 ? "UTC" : "Asia/Ho_Chi_Minh";
    await language.selectOption(expectedLanguage);
    await timezone.fill(expectedTimezone);
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/account/preferences") &&
        response.request().method() === "PUT",
    );
    const startedAt = performance.now();
    await button.click();
    const response = await responsePromise;
    if (response.status() !== 200) {
      throw new Error(
        `PREFERENCES_PERFORMANCE_SAVE_FAILED:${response.status()}`,
      );
    }
    await feedback.waitFor();
    await waitUntil(
      () => button.isEnabled(),
      mutationBudgetMs,
      "preferences save",
    );
    if (
      (await language.inputValue()) !== expectedLanguage ||
      (await timezone.inputValue()) !== expectedTimezone
    ) {
      throw new Error("PREFERENCES_AUTHORITATIVE_VALUE_MISMATCH");
    }
    return performance.now() - startedAt;
  });
}

async function measureDatabaseLatency(client) {
  const timings = await measureSamples(async () => {
    const startedAt = performance.now();
    await client.query("SELECT 1");
    return performance.now() - startedAt;
  });
  return summarize("postgres-round-trip", timings, mutationBudgetMs);
}

async function activeSessionCount(client, userId) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count
       FROM "session"
      WHERE "userId" = $1
        AND "revokedAt" IS NULL
        AND "expiresAt" > CURRENT_TIMESTAMP
        AND "absoluteExpiresAt" > CURRENT_TIMESTAMP`,
    [userId],
  );
  return result.rows[0]?.count ?? 0;
}

async function measurePasswordRevocation(
  primaryPage,
  secondaryPages,
  currentPassword,
) {
  await primaryPage.goto("/profile/security");
  const region = primaryPage.getByRole("region", { name: "Change password" });
  await region.getByLabel("Current password").fill(currentPassword);
  const nextPassword = `Changed ${randomUUID()} profile password!`;
  await region.getByLabel("New password", { exact: true }).fill(nextPassword);
  await region.getByLabel("Confirm new password").fill(nextPassword);
  const responsePromise = primaryPage.waitForResponse(
    (response) =>
      response.url().endsWith("/api/account/password/change") &&
      response.request().method() === "POST",
  );
  await region.getByRole("button", { name: "Change password" }).click();
  const response = await responsePromise;
  await response.finished();
  const responseCompletedAt = performance.now();
  if (response.status() !== 200) {
    throw new Error(`PASSWORD_PERFORMANCE_CHANGE_FAILED:${response.status()}`);
  }

  const rejectionMs = await Promise.all(
    secondaryPages.map(async (page, index) => {
      while (performance.now() - responseCompletedAt <= revocationBudgetMs) {
        const probe = await page.request.get("/api/identity/sessions");
        if (probe.status() === 401) {
          return Number((performance.now() - responseCompletedAt).toFixed(2));
        }
        await delay(10);
      }
      throw new Error(`SESSION_${index + 1}_REVOCATION_TIMEOUT`);
    }),
  );

  const currentStatus = (
    await primaryPage.request.get("/api/identity/sessions")
  ).status();
  await region.getByRole("status").waitFor();
  return {
    otherSessionRejectionMs: rejectionMs,
    maxMs: Math.max(...rejectionMs),
    budgetMs: revocationBudgetMs,
    initiatingSessionStatus: currentStatus,
    passed:
      currentStatus === 200 &&
      rejectionMs.every((elapsed) => elapsed <= revocationBudgetMs),
  };
}

let server;
let browser;
let database;
let fixture;
const contexts = [];

try {
  await assertServerPortIsFree();
  database = new Client({ connectionString: process.env.DATABASE_URL });
  await database.connect();
  fixture = await seedMaximumAccount(database);
  const databaseVersion = (await database.query("SHOW server_version")).rows[0]
    ?.server_version;

  server = startProductionServer();
  await waitForServer(server);
  browser = await chromium.launch({ headless: true });
  const browserVersion = browser.version();

  for (let index = 0; index < 5; index += 1) {
    const signedIn = await signIn(browser, fixture.email, fixture.password);
    contexts.push(signedIn);
  }
  const primaryPage = contexts[0].page;
  const secondaryPages = contexts.slice(1).map(({ page }) => page);
  const profileCounts = await assertMaximumProfile(primaryPage);
  const sessionsBefore = await activeSessionCount(database, fixture.userId);
  if (sessionsBefore !== 5) {
    throw new Error(`PERFORMANCE_SESSION_DATASET_INVALID:${sessionsBefore}`);
  }

  const databaseLatency = await measureDatabaseLatency(database);
  const viewLoads = await measureViewLoads(primaryPage);
  const profileSaves = summarize(
    "profile-save",
    await measureProfileSaves(primaryPage),
    mutationBudgetMs,
  );
  const identitySaves = summarize(
    "identity-save",
    await measureIdentitySaves(primaryPage),
    mutationBudgetMs,
  );
  const preferenceSaves = summarize(
    "preference-save",
    await measurePreferenceSaves(primaryPage),
    mutationBudgetMs,
  );
  const sessionsImmediatelyBeforePasswordChange = await activeSessionCount(
    database,
    fixture.userId,
  );
  if (sessionsImmediatelyBeforePasswordChange !== 5) {
    throw new Error(
      `PASSWORD_SESSION_DATASET_INVALID:${sessionsImmediatelyBeforePasswordChange}`,
    );
  }
  const passwordRevocation = await measurePasswordRevocation(
    primaryPage,
    secondaryPages,
    fixture.password,
  );
  const sessionsAfter = await activeSessionCount(database, fixture.userId);
  const packageManifest = JSON.parse(
    await readFile(resolve(webRoot, "package.json"), "utf8"),
  );
  const cpu = os.cpus()[0];
  const mutations = [profileSaves, identitySaves, preferenceSaves];
  const passed =
    databaseLatency.passed &&
    viewLoads.every((result) => result.passed) &&
    mutations.every((result) => result.passed) &&
    passwordRevocation.passed &&
    sessionsAfter === 1;

  const output = {
    recordedAt: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: `${os.platform()} ${os.release()} ${os.arch()}`,
      cpu: cpu?.model ?? "unknown",
      logicalCpuCount: os.cpus().length,
      totalMemoryGiB: Number((os.totalmem() / 1024 ** 3).toFixed(2)),
      browser: `Chromium ${browserVersion}`,
      next: packageManifest.dependencies.next,
      betterAuth: packageManifest.dependencies["better-auth"],
      postgres: databaseVersion,
      serverMode: "production next start",
      emailAdapter: "capture",
      viewport: "1280x720",
      reducedMotion: "reduce",
      warmupsPerClass: 1,
    },
    dataset: {
      ...profileCounts,
      activeSessions: sessionsBefore,
      sharedSkillCatalog:
        "50 run-specific normalized skills plus existing catalog",
    },
    databaseLatency,
    viewLoads,
    mutations,
    passwordRevocation: {
      ...passwordRevocation,
      activeSessionsBefore: sessionsImmediatelyBeforePasswordChange,
      activeSessionsAfter: sessionsAfter,
    },
    passed,
  };

  process.stdout.write(
    `\nPROFILE_ACCOUNT_PERFORMANCE_RESULT\n${JSON.stringify(output, null, 2)}\n`,
  );
  if (!passed) throw new Error("PROFILE_ACCOUNT_PERFORMANCE_BUDGET_FAILED");
} finally {
  await Promise.allSettled(contexts.map(({ context }) => context.close()));
  if (browser) await browser.close().catch(() => undefined);
  await stopProductionServer(server).catch(() => undefined);
  if (database) {
    await cleanupMaximumAccount(database, fixture).catch((error) => {
      process.stderr.write(
        `Performance fixture cleanup failed: ${
          error instanceof Error ? error.message : "unknown"
        }\n`,
      );
    });
    await database.end().catch(() => undefined);
  }
}
