import crypto from "crypto";
import fs from "fs";
import path from "path";

const MIGRATION_ROOT = "/var/data";

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function isMountedAt(target, mountInfoPath = "/proc/self/mountinfo") {
  if (!fs.existsSync(mountInfoPath)) return false;
  const expected = path.resolve(target);
  const mounts = fs.readFileSync(mountInfoPath, "utf8").split(/\r?\n/);
  return mounts.some((line) => {
    const mountPoint = line.split(" ")[4];
    if (!mountPoint) return false;
    const decoded = mountPoint.replace(/\\([0-7]{3})/g, (_match, octal) => String.fromCharCode(parseInt(octal, 8)));
    return path.resolve(decoded) === expected;
  });
}

function fileSignature(filePath, { requireNonEmpty = false } = {}) {
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink() || (requireNonEmpty && stat.size <= 0)) {
    fail("MIGRATION_INVALID_FILE");
  }

  const hash = crypto.createHash("sha256");
  const descriptor = fs.openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(64 * 1024);
  try {
    let bytesRead;
    while ((bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return { size: stat.size, hash: hash.digest("hex") };
}

function sameSignature(left, right) {
  return left.size === right.size && left.hash === right.hash;
}

function copyNewFile(sourcePath, destinationPath, { requireNonEmpty = false, conflictCode }) {
  const sourceBefore = fileSignature(sourcePath, { requireNonEmpty });
  const tempPath = path.join(
    path.dirname(destinationPath),
    `.${path.basename(destinationPath)}.migration-${process.pid}-${crypto.randomBytes(8).toString("hex")}.tmp`
  );

  try {
    fs.copyFileSync(sourcePath, tempPath, fs.constants.COPYFILE_EXCL);
    const copied = fileSignature(tempPath, { requireNonEmpty });
    const sourceAfter = fileSignature(sourcePath, { requireNonEmpty });
    if (!sameSignature(sourceBefore, copied) || !sameSignature(sourceBefore, sourceAfter)) {
      fail("MIGRATION_SOURCE_CHANGED");
    }

    try {
      // A hard link publishes the verified temp atomically without replacing an existing destination.
      fs.linkSync(tempPath, destinationPath);
      return "copied";
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const existing = fileSignature(destinationPath, { requireNonEmpty });
      if (!sameSignature(sourceBefore, existing)) fail(conflictCode);
      return "existing";
    }
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
}

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
  const stat = fs.lstatSync(directoryPath);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail("MIGRATION_INVALID_DIRECTORY");
}

function copyUploads(sourceRoot, destinationRoot, counts) {
  if (!fs.existsSync(sourceRoot)) {
    ensureDirectory(destinationRoot);
    return;
  }

  const sourceRootStat = fs.lstatSync(sourceRoot);
  if (!sourceRootStat.isDirectory() || sourceRootStat.isSymbolicLink()) fail("MIGRATION_INVALID_UPLOADS_SOURCE");
  ensureDirectory(destinationRoot);

  const copyDirectory = (sourceDirectory, destinationDirectory) => {
    for (const entry of fs.readdirSync(sourceDirectory, { withFileTypes: true })) {
      const sourcePath = path.join(sourceDirectory, entry.name);
      const destinationPath = path.join(destinationDirectory, entry.name);
      if (entry.isSymbolicLink()) fail("MIGRATION_UPLOADS_SYMLINK");
      if (entry.isDirectory()) {
        if (fs.existsSync(destinationPath)) {
          const destinationStat = fs.lstatSync(destinationPath);
          if (!destinationStat.isDirectory() || destinationStat.isSymbolicLink()) fail("MIGRATION_UPLOADS_CONFLICT");
        } else {
          fs.mkdirSync(destinationPath);
        }
        copyDirectory(sourcePath, destinationPath);
        continue;
      }
      if (!entry.isFile()) fail("MIGRATION_UPLOADS_UNSUPPORTED_ENTRY");

      if (fs.existsSync(destinationPath)) {
        const sourceSignature = fileSignature(sourcePath);
        const destinationSignature = fileSignature(destinationPath);
        if (!sameSignature(sourceSignature, destinationSignature)) fail("MIGRATION_UPLOADS_CONFLICT");
        counts.uploadsExisting += 1;
        continue;
      }

      const result = copyNewFile(sourcePath, destinationPath, { conflictCode: "MIGRATION_UPLOADS_CONFLICT" });
      counts.uploadsCopied += result === "copied" ? 1 : 0;
      counts.uploadsExisting += result === "existing" ? 1 : 0;
    }
  };

  copyDirectory(sourceRoot, destinationRoot);
}

export function migratePersistentDisk({
  enabled,
  sourceDbPath,
  destinationDbPath,
  sourceUploadsPath,
  destinationUploadsPath,
  backupDirectory,
  persistentRoot = MIGRATION_ROOT,
  isPersistentDiskMounted = isMountedAt
}) {
  if (!enabled) return { status: "disabled" };

  const expectedDbPath = path.resolve(persistentRoot, "rfa.db");
  const expectedUploadsPath = path.resolve(persistentRoot, "uploads");
  const expectedBackupPath = path.resolve(persistentRoot, "backups");
  if (
    path.resolve(destinationDbPath) !== expectedDbPath ||
    path.resolve(destinationUploadsPath) !== expectedUploadsPath ||
    path.resolve(backupDirectory) !== expectedBackupPath
  ) {
    fail("MIGRATION_PATH_MISMATCH");
  }
  if (!isPersistentDiskMounted(persistentRoot)) fail("MIGRATION_DISK_NOT_MOUNTED");

  ensureDirectory(persistentRoot);
  ensureDirectory(backupDirectory);

  let dbStatus;
  if (fs.existsSync(destinationDbPath)) {
    const destinationSignature = fileSignature(destinationDbPath, { requireNonEmpty: true });
    if (fs.existsSync(sourceDbPath)) {
      const sourceSignature = fileSignature(sourceDbPath, { requireNonEmpty: true });
      if (!sameSignature(sourceSignature, destinationSignature)) fail("MIGRATION_DB_CONFLICT");
      dbStatus = "already-migrated";
    } else {
      dbStatus = "destination-present";
    }
  } else {
    if (!fs.existsSync(sourceDbPath)) fail("MIGRATION_DB_SOURCE_MISSING");
    const result = copyNewFile(sourceDbPath, destinationDbPath, {
      requireNonEmpty: true,
      conflictCode: "MIGRATION_DB_CONFLICT"
    });
    dbStatus = result === "copied" ? "copied" : "already-migrated";
  }

  const counts = { uploadsCopied: 0, uploadsExisting: 0 };
  copyUploads(sourceUploadsPath, destinationUploadsPath, counts);
  return { status: dbStatus, ...counts };
}
