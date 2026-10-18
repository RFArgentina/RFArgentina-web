import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { migratePersistentDisk } from "../persistent-disk-migration.js";

function fixture(t, { database = Buffer.from("sqlite fixture"), uploads = { "case-a.pdf": Buffer.from("attachment") } } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rfa-disk-migration-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const backend = path.join(root, "backend");
  const disk = path.join(root, "disk");
  const legacyUploads = path.join(backend, "uploads");
  fs.mkdirSync(backend, { recursive: true });
  fs.mkdirSync(disk, { recursive: true });
  if (database !== null) fs.writeFileSync(path.join(backend, "rfa.db"), database);
  if (uploads !== null) {
    fs.mkdirSync(legacyUploads, { recursive: true });
    for (const [name, contents] of Object.entries(uploads)) {
      const filePath = path.join(legacyUploads, name);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, contents);
    }
  }

  const config = {
    enabled: true,
    sourceDbPath: path.join(backend, "rfa.db"),
    destinationDbPath: path.join(disk, "rfa.db"),
    sourceUploadsPath: legacyUploads,
    destinationUploadsPath: path.join(disk, "uploads"),
    backupDirectory: path.join(disk, "backups"),
    persistentRoot: disk,
    isPersistentDiskMounted: () => true
  };
  return { root, backend, disk, config };
}

test("disabled migration returns without touching paths", () => {
  assert.deepEqual(migratePersistentDisk({ enabled: false }), { status: "disabled" });
});

test("server gates migration explicitly and runs it before upload setup and SQLite initialization", () => {
  const source = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
  const activation = source.indexOf('if (process.env.MIGRATE_TO_PERSISTENT_DISK === "true")');
  const uploadSetup = source.indexOf("if (!fs.existsSync(UPLOADS_DIR))");
  const sqliteInitialization = source.indexOf("initSqlJs({ locateFile:");
  assert.notEqual(activation, -1);
  assert.ok(activation < uploadSetup);
  assert.ok(activation < sqliteInitialization);
});

test("copies a non-empty legacy database and uploads without altering legacy files", (t) => {
  const { backend, disk, config } = fixture(t);
  const result = migratePersistentDisk(config);
  assert.equal(result.status, "copied");
  assert.equal(result.uploadsCopied, 1);
  assert.equal(fs.readFileSync(path.join(disk, "rfa.db"), "utf8"), "sqlite fixture");
  assert.equal(fs.readFileSync(path.join(disk, "uploads", "case-a.pdf"), "utf8"), "attachment");
  assert.equal(fs.readFileSync(path.join(backend, "rfa.db"), "utf8"), "sqlite fixture");
  assert.equal(fs.readFileSync(path.join(backend, "uploads", "case-a.pdf"), "utf8"), "attachment");
  assert.ok(fs.statSync(path.join(disk, "backups")).isDirectory());
});

test("continues when an existing destination database is identical", (t) => {
  const { disk, config } = fixture(t);
  fs.writeFileSync(path.join(disk, "rfa.db"), "sqlite fixture");
  const originalMtime = fs.statSync(path.join(disk, "rfa.db")).mtimeMs;
  const result = migratePersistentDisk(config);
  assert.equal(result.status, "already-migrated");
  assert.equal(fs.statSync(path.join(disk, "rfa.db")).mtimeMs, originalMtime);
});

test("aborts on a database conflict without overwriting destination", (t) => {
  const { disk, config } = fixture(t);
  fs.writeFileSync(path.join(disk, "rfa.db"), "different database");
  assert.throws(() => migratePersistentDisk(config), { code: "MIGRATION_DB_CONFLICT" });
  assert.equal(fs.readFileSync(path.join(disk, "rfa.db"), "utf8"), "different database");
});

test("aborts before database initialization when both database paths are absent", (t) => {
  const { disk, config } = fixture(t, { database: null });
  assert.throws(() => migratePersistentDisk(config), { code: "MIGRATION_DB_SOURCE_MISSING" });
  assert.equal(fs.existsSync(path.join(disk, "rfa.db")), false);
});

test("aborts on conflicting upload content without replacing the existing file", (t) => {
  const { disk, config } = fixture(t);
  fs.mkdirSync(path.join(disk, "uploads"), { recursive: true });
  fs.writeFileSync(path.join(disk, "uploads", "case-a.pdf"), "different attachment");
  assert.throws(() => migratePersistentDisk(config), { code: "MIGRATION_UPLOADS_CONFLICT" });
  assert.equal(fs.readFileSync(path.join(disk, "uploads", "case-a.pdf"), "utf8"), "different attachment");
});

test("second execution is idempotent and does not overwrite migrated files", (t) => {
  const { disk, config } = fixture(t);
  migratePersistentDisk(config);
  const dbMtime = fs.statSync(path.join(disk, "rfa.db")).mtimeMs;
  const uploadMtime = fs.statSync(path.join(disk, "uploads", "case-a.pdf")).mtimeMs;
  const result = migratePersistentDisk(config);
  assert.equal(result.status, "already-migrated");
  assert.equal(result.uploadsCopied, 0);
  assert.equal(fs.statSync(path.join(disk, "rfa.db")).mtimeMs, dbMtime);
  assert.equal(fs.statSync(path.join(disk, "uploads", "case-a.pdf")).mtimeMs, uploadMtime);
});

test("rejects an empty legacy database", (t) => {
  const { config } = fixture(t, { database: Buffer.alloc(0) });
  assert.throws(() => migratePersistentDisk(config), { code: "MIGRATION_INVALID_FILE" });
});
