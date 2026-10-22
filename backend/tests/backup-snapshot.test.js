import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createBackupSnapshot } from "../scripts/backup-db.mjs";

test("backup snapshot atomically includes SQLite, nested uploads, and verifiable hashes", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "rfa-backup-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dataDir = path.join(root, "data");
  const backupDir = path.join(dataDir, "backups");
  const uploadsDir = path.join(dataDir, "uploads");
  const dbPath = path.join(dataDir, "rfa.db");
  await mkdir(path.join(uploadsDir, "nested"), { recursive: true });
  await writeFile(dbPath, "sqlite-bytes");
  await writeFile(path.join(uploadsDir, "case.pdf"), "case-attachment");
  await writeFile(path.join(uploadsDir, "nested", "receipt.pdf"), "payment-receipt");

  const result = createBackupSnapshot({ dbPath, uploadsPath: uploadsDir, backupDir, now: new Date("2026-10-22T12:00:00.000Z") });
  const archivedDb = await readFile(path.join(result.path, "rfa.db"), "utf8");
  const archivedAttachment = await readFile(path.join(result.path, "uploads", "case.pdf"), "utf8");
  const archivedReceipt = await readFile(path.join(result.path, "uploads", "nested", "receipt.pdf"), "utf8");
  const manifest = JSON.parse(await readFile(path.join(result.path, "manifest.json"), "utf8"));

  assert.equal(archivedDb, "sqlite-bytes");
  assert.equal(archivedAttachment, "case-attachment");
  assert.equal(archivedReceipt, "payment-receipt");
  assert.equal(result.uploadsCount, 2);
  assert.equal(manifest.uploads.count, 2);
  assert.equal(manifest.database.sha256.length, 64);
  assert.equal(manifest.uploads.files.every((file) => file.sha256.length === 64), true);
  assert.deepEqual(await readFile(dbPath), Buffer.from("sqlite-bytes"));
});

test("backup failure preserves existing snapshots and retention runs only after publication", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "rfa-backup-retention-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dbPath = path.join(root, "rfa.db");
  const uploadsDir = path.join(root, "uploads");
  const backupDir = path.join(root, "backups");
  const oldSnapshot = path.join(backupDir, "rfa-backup-20250101T000000000Z-12345678");
  await mkdir(oldSnapshot, { recursive: true });
  await writeFile(path.join(oldSnapshot, "preserve.txt"), "previous complete snapshot");
  const oldTime = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
  await utimes(oldSnapshot, oldTime, oldTime);

  await writeFile(dbPath, "");
  assert.throws(() => createBackupSnapshot({ dbPath, uploadsPath: uploadsDir, backupDir, retentionDays: 14 }), /missing or invalid/);
  assert.equal(await readFile(path.join(oldSnapshot, "preserve.txt"), "utf8"), "previous complete snapshot");

  await writeFile(dbPath, "valid database bytes");
  const result = createBackupSnapshot({ dbPath, uploadsPath: uploadsDir, backupDir, retentionDays: 14 });
  assert.equal(result.uploadsCount, 0);
  await assert.rejects(readFile(path.join(oldSnapshot, "preserve.txt")));
  assert.equal(await readFile(path.join(result.path, "manifest.json"), "utf8").then((text) => JSON.parse(text).uploads.count), 0);
});
