import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const frontendOrigin = "https://rfargentina.com";

async function unusedPort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForHealth(baseUrl, child, output) {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Backend exited: ${output()}`);
    try {
      if ((await fetch(`${baseUrl}/health`)).ok) return;
    } catch { /* still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Health timeout: ${output()}`);
}

function cookiesFrom(response) {
  return response.headers.getSetCookie().map((line) => line.split(";", 1)[0]).join("; ");
}

test("cross-origin session refresh uses API-issued CSRF without exposing the HttpOnly refresh token", { timeout: 180000 }, async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rfa-csrf-"));
  const port = await unusedPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let output = "";
  const child = spawn(process.execPath, ["server.js"], {
    cwd: backendDir,
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      SQLITE_PATH: path.join(dir, "test.db"),
      UPLOADS_PATH: path.join(dir, "uploads"),
      BACKUP_DIR: path.join(dir, "backups"),
      JWT_SECRET: "auth-csrf-integration-secret-0123456789",
      ADMIN_EMAILS: "admin-csrf@test.local",
      ADMIN_BOOTSTRAP_PASSWORD: "TestAdminPassword123",
      DATA_PURGE_ENABLED: "false",
      MIGRATE_TO_PERSISTENT_DISK: "false",
      CORS_ORIGINS: frontendOrigin,
      REFRESH_TOKEN_SECURE_COOKIE: "true",
      REFRESH_TOKEN_SAME_SITE: "none"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => { output = (output + chunk.toString()).slice(-12000); });
  child.stderr.on("data", (chunk) => { output = (output + chunk.toString()).slice(-12000); });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      let timer;
      try {
        await Promise.race([once(child, "exit"), new Promise((resolve) => { timer = setTimeout(resolve, 8000); })]);
      } finally {
        clearTimeout(timer);
      }
    }
    await rm(dir, { recursive: true, force: true });
  });
  await waitForHealth(baseUrl, child, () => output);

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { Origin: frontendOrigin, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin-csrf@test.local", password: "TestAdminPassword123" })
  });
  assert.equal(login.status, 200);
  assert.equal(login.headers.get("access-control-allow-origin"), frontendOrigin);
  assert.equal(login.headers.get("access-control-allow-credentials"), "true");
  const preflight = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: "OPTIONS",
    headers: {
      Origin: frontendOrigin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "x-csrf-token,content-type"
    }
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), frontendOrigin);
  assert.match(preflight.headers.get("access-control-allow-headers") || "", /X-CSRF-Token/i);
  const setCookies = login.headers.getSetCookie();
  assert.ok(setCookies.some((line) => /rfa_refresh_token=.*HttpOnly/i.test(line) && /Secure/i.test(line) && /SameSite=None/i.test(line)));
  let cookie = cookiesFrom(login);

  const bootstrap = await fetch(`${baseUrl}/api/auth/csrf`, { headers: { Origin: frontendOrigin, Cookie: cookie } });
  assert.equal(bootstrap.status, 200);
  assert.equal(bootstrap.headers.get("cache-control"), "no-store, private");
  const csrf = (await bootstrap.json()).csrf_token;
  assert.ok(csrf);
  assert.ok(!setCookies.some((line) => line.includes(csrf) && line.includes("HttpOnly")));

  const refresh = (extraHeaders = {}) => fetch(`${baseUrl}/api/auth/refresh`, {
    method: "POST",
    headers: { Origin: frontendOrigin, Cookie: cookie, "Content-Type": "application/json", ...extraHeaders },
    body: "{}"
  });
  assert.equal((await refresh()).status, 403);
  assert.equal((await refresh({ "X-CSRF-Token": "wrong" })).status, 403);
  const validRefresh = await refresh({ "X-CSRF-Token": csrf });
  assert.equal(validRefresh.status, 200);
  assert.ok((await validRefresh.json()).token);
  cookie = cookiesFrom(validRefresh);
  assert.ok(cookie.includes("rfa_refresh_token="));

  const blockedOrigin = await fetch(`${baseUrl}/api/auth/csrf`, {
    headers: { Origin: "https://untrusted.example", Cookie: cookie }
  });
  assert.equal(blockedOrigin.status, 403);
  assert.equal(blockedOrigin.headers.get("access-control-allow-origin"), null);
});
