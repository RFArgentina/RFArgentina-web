import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function unusedPort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function startBackend(dir) {
  const port = await unusedPort();
  const url = `http://127.0.0.1:${port}`;
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
      JWT_SECRET: "sqlite-recovery-test-secret-0123456789",
      ADMIN_EMAILS: "admin-recovery@test.local",
      ADMIN_BOOTSTRAP_PASSWORD: "TestAdminPassword123",
      DATA_PURGE_ENABLED: "false",
      MIGRATE_TO_PERSISTENT_DISK: "false",
      DB_FLUSH_INTERVAL_MS: "60000",
      CORS_ORIGINS: "http://localhost:3000"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => { output = (output + chunk.toString()).slice(-12000); });
  child.stderr.on("data", (chunk) => { output = (output + chunk.toString()).slice(-12000); });
  return { child, url, output: () => output };
}

async function waitForHealth(started) {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (started.child.exitCode !== null) throw new Error(`Backend exited: ${started.output()}`);
    try {
      if ((await fetch(`${started.url}/health`)).status === 200) return;
    } catch { /* still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Health timeout: ${started.output()}`);
}

async function stopBackend(started) {
  if (started.child.exitCode !== null || started.child.signalCode !== null) return;
  started.child.kill("SIGTERM");
  let timer;
  try {
    await Promise.race([once(started.child, "exit"), new Promise((resolve) => { timer = setTimeout(resolve, 8000); })]);
  } finally {
    clearTimeout(timer);
  }
}

test("SQLite startup validates main and backup without losing recoverable data", { timeout: 240000 }, async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "rfa-sqlite-recovery-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const corrupt = Buffer.from("not-a-sqlite-database");

  async function scenario(name, main, backup, expectedHealthy) {
    const dir = path.join(root, name);
    await mkdir(dir);
    const mainPath = path.join(dir, "test.db");
    const bakPath = `${mainPath}.bak`;
    if (main) await writeFile(mainPath, main);
    if (backup) await writeFile(bakPath, backup);
    const started = await startBackend(dir);
    t.after(() => stopBackend(started));
    if (expectedHealthy) {
      await waitForHealth(started);
    } else {
      let timer;
      try {
        await Promise.race([
          once(started.child, "exit"),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Corrupt DB unexpectedly started")), 30000); })
        ]);
      } finally {
        clearTimeout(timer);
      }
      assert.notEqual(started.child.exitCode, 0);
    }
    return { started, mainPath, bakPath };
  }

  const fresh = await scenario("fresh", null, null, true);
  await stopBackend(fresh.started);
  assert.ok((await stat(fresh.mainPath)).size > 0);
  const validBytes = await readFile(fresh.mainPath);

  const valid = await scenario("valid-main", validBytes, validBytes, true);
  assert.deepEqual(await readFile(valid.mainPath), validBytes);
  assert.deepEqual(await readFile(valid.bakPath), validBytes);
  assert.doesNotMatch(valid.started.output(), /restored verified backup/);
  await stopBackend(valid.started);

  const recovered = await scenario("recovered", corrupt, validBytes, true);
  assert.deepEqual(await readFile(recovered.mainPath), validBytes);
  assert.deepEqual(await readFile(recovered.bakPath), validBytes);
  assert.match(recovered.started.output(), /restored verified backup/);
  await stopBackend(recovered.started);

  const failed = await scenario("both-corrupt", corrupt, corrupt, false);
  assert.deepEqual(await readFile(failed.mainPath), corrupt);
  assert.deepEqual(await readFile(failed.bakPath), corrupt);

});
