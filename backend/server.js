import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import axios from "axios";
import { parseStringPromise } from "xml2js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomBytes, randomInt, randomUUID, createHash } from "crypto";
import multer from "multer";
import { Worker } from "worker_threads";
import { migratePersistentDisk } from "./persistent-disk-migration.js";
import {
  createConversationAccessToken,
  hashConversationAccessToken,
  isConversationAccessTokenActive
} from "./conversation-access.js";
import {
  isValidCommunicationMode,
  parseAcceptedProposalSnapshot,
  serializeAcceptedProposalSnapshot
} from "./commercial-proposal.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = String(process.env.NODE_ENV || "development").toLowerCase();
const IS_PROD = NODE_ENV === "production";

const CORS_ORIGINS = (process.env.CORS_ORIGINS || "").split(",").map((v) => v.trim()).filter(Boolean);
const JWT_SECRET = process.env.JWT_SECRET || "";
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
const ADMIN_BOOTSTRAP_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD || "";
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";
const SQLITE_PATH = process.env.SQLITE_PATH || "./rfa.db";
const UPLOADS_PATH = process.env.UPLOADS_PATH || "./uploads";
const CASE_ATTACHMENT_MAX_FILES = 5;
const CASE_ATTACHMENT_MAX_FILE_BYTES = 25 * 1024 * 1024;
const PUBLIC_CASE_ATTACHMENT_MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const IMPORT_MAX_FILES = 5;
const IMPORT_MAX_FILE_BYTES = 10 * 1024 * 1024;
const IMPORT_MAX_TOTAL_BYTES = 25 * 1024 * 1024;
const IMPORT_MAX_ROWS = 10000;
const IMPORT_MAX_COLUMNS = 200;
const PUBLIC_ACTION_TOKEN_TTL_HOURS = 72;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, SQLITE_PATH);
const UPLOADS_DIR = path.resolve(__dirname, UPLOADS_PATH);
if (process.env.MIGRATE_TO_PERSISTENT_DISK === "true") {
  try {
    const migration = migratePersistentDisk({
      enabled: true,
      sourceDbPath: path.resolve(__dirname, "./rfa.db"),
      destinationDbPath: DB_PATH,
      sourceUploadsPath: path.resolve(__dirname, "./uploads"),
      destinationUploadsPath: UPLOADS_DIR,
      backupDirectory: path.resolve(__dirname, process.env.BACKUP_DIR || "./backups")
    });
    console.log("PERSISTENT DISK MIGRATION:", migration.status, migration.uploadsCopied, migration.uploadsExisting);
  } catch (error) {
    console.error("PERSISTENT DISK MIGRATION FAILED:", error.code || "MIGRATION_ERROR");
    process.exit(1);
  }
}
const TRUST_PROXY_RAW = String(process.env.TRUST_PROXY ?? "false").trim().toLowerCase();
const TRUST_PROXY = (() => {
  if (!TRUST_PROXY_RAW || TRUST_PROXY_RAW === "false" || TRUST_PROXY_RAW === "0" || TRUST_PROXY_RAW === "off") {
    return false;
  }
  if (TRUST_PROXY_RAW === "true") {
    // "true" es demasiado permisivo para express-rate-limit; limitar a un proxy.
    return 1;
  }
  if (/^\d+$/.test(TRUST_PROXY_RAW)) {
    return Number(TRUST_PROXY_RAW);
  }
  if (["loopback", "linklocal", "uniquelocal"].includes(TRUST_PROXY_RAW)) {
    return TRUST_PROXY_RAW;
  }
  // fallback seguro para despliegues tipicos detras de un solo proxy
  return 1;
})();
const TRUST_PROXY_ENABLED = TRUST_PROXY !== false;
const LOGIN_MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS || 8);
const LOGIN_LOCK_MS = Number(process.env.LOGIN_LOCK_MINUTES || 15) * 60 * 1000;
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const REFRESH_TOKEN_DAYS = Number(process.env.REFRESH_TOKEN_DAYS || 30);
const REFRESH_TOKEN_COOKIE = process.env.REFRESH_TOKEN_COOKIE || "rfa_refresh_token";
const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || "rfa_csrf_token";
const REFRESH_TOKEN_SECURE_COOKIE = String(process.env.REFRESH_TOKEN_SECURE_COOKIE || "false").toLowerCase() === "true";
const REFRESH_TOKEN_SAME_SITE = process.env.REFRESH_TOKEN_SAME_SITE || "lax";
const USER_RETENTION_DAYS = Number(process.env.USER_RETENTION_DAYS || 90);
const DATA_PURGE_INTERVAL_HOURS = Number(process.env.DATA_PURGE_INTERVAL_HOURS || 24);
const DATA_PURGE_ENABLED = String(process.env.DATA_PURGE_ENABLED || "true").trim().toLowerCase() !== "false";
const DB_FLUSH_INTERVAL_MS = Number(process.env.DB_FLUSH_INTERVAL_MS || 1500);
const POLICY_CONSENT_VERSION = "2026-10-09";
const INITIAL_ANALYSIS_SERVICE_CODE = "analysis";
const PARTICULAR_SERVICE_CODES = new Set(["analysis", "professional-folder", "rfa-management"]);
const PAID_SERVICE_CODES = new Set(["professional-folder", "rfa-management"]);
const COMMERCIAL_STATUSES = new Set(["analysis", "proposal_sent", "accepted", "payment_pending", "paid"]);
const PARTICULAR_OPERATIONAL_STATUSES = new Set([
  "received",
  "in_analysis",
  "needs_information",
  "in_progress",
  "completed",
  "referred",
  "not_applicable"
]);

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET debe estar configurado con al menos 32 caracteres");
}

const appBaseOrigin = (() => {
  try {
    return new URL(APP_BASE_URL).origin;
  } catch {
    return null;
  }
})();
const allowedOrigins = CORS_ORIGINS.length
  ? CORS_ORIGINS
  : [appBaseOrigin, "http://localhost:3000", "http://127.0.0.1:3000"].filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (IS_PROD) return false;
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname.toLowerCase();
    const protocol = parsed.protocol.toLowerCase();
    if ((host === "localhost" || host === "127.0.0.1") && ["http:", "https:"].includes(protocol)) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function isLocalOrigin(origin) {
  const value = String(origin || "").toLowerCase();
  return value.includes("localhost") || value.includes("127.0.0.1");
}

function validateRuntimeSecurityConfig() {
  const issues = [];
  const warnings = [];
  const sameSite = String(REFRESH_TOKEN_SAME_SITE || "lax").toLowerCase();

  if (!["lax", "strict", "none"].includes(sameSite)) {
    issues.push("REFRESH_TOKEN_SAME_SITE debe ser lax, strict o none");
  }

  if (sameSite === "none" && !REFRESH_TOKEN_SECURE_COOKIE) {
    issues.push("REFRESH_TOKEN_SAME_SITE=none requiere REFRESH_TOKEN_SECURE_COOKIE=true");
  }

  if (!Number.isFinite(USER_RETENTION_DAYS) || USER_RETENTION_DAYS < 30 || USER_RETENTION_DAYS > 365) {
    issues.push("USER_RETENTION_DAYS debe estar entre 30 y 365");
  }

  if (!Number.isFinite(DATA_PURGE_INTERVAL_HOURS) || DATA_PURGE_INTERVAL_HOURS < 1 || DATA_PURGE_INTERVAL_HOURS > 168) {
    issues.push("DATA_PURGE_INTERVAL_HOURS debe estar entre 1 y 168");
  }

  if (!Number.isFinite(DB_FLUSH_INTERVAL_MS) || DB_FLUSH_INTERVAL_MS < 100 || DB_FLUSH_INTERVAL_MS > 60000) {
    issues.push("DB_FLUSH_INTERVAL_MS debe estar entre 100 y 60000");
  }

  if (IS_PROD) {
    if (!REFRESH_TOKEN_SECURE_COOKIE) {
      issues.push("En produccion REFRESH_TOKEN_SECURE_COOKIE debe ser true");
    }
    if (!String(APP_BASE_URL || "").toLowerCase().startsWith("https://")) {
      issues.push("En produccion APP_BASE_URL debe usar https");
    }
    if (!allowedOrigins.length) {
      issues.push("En produccion CORS_ORIGINS no puede estar vacio");
    }
    if (allowedOrigins.some(isLocalOrigin)) {
      issues.push("En produccion CORS_ORIGINS no debe incluir localhost/127.0.0.1");
    }
    if (!TRUST_PROXY_ENABLED) {
      warnings.push("TRUST_PROXY=false en produccion; revisar si usas reverse proxy");
    }
  }

  if (warnings.length) {
    warnings.forEach((warning) => console.warn("CONFIG WARN:", warning));
  }
  if (issues.length) {
    throw new Error(`Configuracion insegura de entorno:\n- ${issues.join("\n- ")}`);
  }
}

validateRuntimeSecurityConfig();

app.set("trust proxy", TRUST_PROXY);
app.disable("x-powered-by");
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes, intenta nuevamente en unos minutos" }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de autenticacion, espera unos minutos" }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: "Demasiados intentos. Intenta nuevamente en unos minutos" }
});
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Intenta nuevamente en unos minutos" }
});
const lookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 15, standardHeaders: true, legacyHeaders: false,
  message: { error: "No se pudo completar la solicitud. Intenta nuevamente en unos minutos" }
});
const publicCaseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 8, standardHeaders: true, legacyHeaders: false,
  message: { error: "No se pudo completar la solicitud. Intenta nuevamente en unos minutos" }
});
const publicActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  message: { error: "No se pudo completar la solicitud. Intenta nuevamente en unos minutos" }
});
const publicActionGrantLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: "No se pudo completar la solicitud. Intenta nuevamente en unos minutos" }
});
const publicReceiptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  message: { error: "No se pudo completar la solicitud. Intenta nuevamente en unos minutos" }
});
const enterpriseInquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  message: { error: "No se pudo completar la solicitud. Intenta nuevamente en unos minutos" }
});
const adminActionTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: "No se pudo completar la solicitud. Intenta nuevamente en unos minutos" }
});
const importLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  message: { error: "Demasiadas importaciones. Intenta nuevamente en unos minutos" }
});
const authenticatedUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: "Demasiadas cargas de archivos. Intenta nuevamente en unos minutos" }
});
const conversationReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false,
  message: { error: "No se pudo completar la solicitud. Intenta nuevamente en unos minutos" }
});
const conversationWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 6, standardHeaders: true, legacyHeaders: false,
  message: { error: "No se pudo completar la solicitud. Intenta nuevamente en unos minutos" }
});
const conversationAdminWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: "No se pudo completar la solicitud. Intenta nuevamente en unos minutos" }
});

app.use(cors({
  origin(origin, cb) {
    if (isAllowedOrigin(origin)) return cb(null, true);
    return cb(new Error("Origen no permitido por CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token", "X-RFA-Conversation-Token"]
}));
app.use(globalLimiter);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(cookieParser());
app.use((req, res, next) => {
  const requestId = randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  const startAt = Date.now();
  res.on("finish", () => {
    const elapsedMs = Date.now() - startAt;
    console.log(
      JSON.stringify({
        type: "http_access",
        requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        elapsedMs
      })
    );
  });
  next();
});

let db = null;
let server = null;
let shuttingDown = false;

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: CASE_ATTACHMENT_MAX_FILE_BYTES, files: CASE_ATTACHMENT_MAX_FILES, fields: 20, parts: 25 },
  fileFilter: (_req, file, cb) => {
    const allowedByExtension = new Map([
      [".pdf", new Set(["application/pdf"])],
      [".png", new Set(["image/png"])],
      [".jpg", new Set(["image/jpeg"])],
      [".jpeg", new Set(["image/jpeg"])],
      [".doc", new Set(["application/msword"])],
      [".docx", new Set(["application/vnd.openxmlformats-officedocument.wordprocessingml.document"])],
      [".txt", new Set(["text/plain"]) ]
    ]);
    const ext = path.extname(String(file.originalname || "")).toLowerCase();
    const allowedMime = allowedByExtension.get(ext);
    if (allowedMime?.has(String(file.mimetype || "").toLowerCase())) return cb(null, true);
    const error = new Error("Unsupported public case attachment type");
    error.code = "UNSUPPORTED_FILE_TYPE";
    error.fileName = file.originalname;
    error.field = file.fieldname;
    return cb(error);
  }
});

const importUpload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: IMPORT_MAX_FILE_BYTES, files: IMPORT_MAX_FILES, fields: 10, parts: 15 },
  fileFilter: (_req, file, cb) => {
    const allowedMime = [
      "text/csv",
      "application/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "application/octet-stream"
    ];
    const ext = path.extname(String(file.originalname || "")).toLowerCase();
    const allowedExt = [".csv", ".xlsx"];
    if (allowedMime.includes(file.mimetype) && allowedExt.includes(ext)) return cb(null, true);
    return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
  }
});

function maybeUpload(req, res, next) {
  if (!req.is("multipart/form-data")) return next();
  return upload.array("adjuntos", CASE_ATTACHMENT_MAX_FILES)(req, res, (err) => {
    if (err) return next(err);
    const files = req.files || [];
    const validationError = validateUploadedFiles(files);
    if (validationError) {
      files.forEach(deleteUploadedFile);
      req.files = [];
      return res.status(400).json({ error: validationError });
    }
    return next();
  });
}

function conversationUpload(req, res, next) {
  if (!req.is("multipart/form-data")) return next();
  return upload.array("adjuntos", CASE_ATTACHMENT_MAX_FILES)(req, res, (err) => {
    if (err) return next(err);
    const files = req.files || [];
    const validationError = validateUploadedFiles(files);
    if (validationError) {
      files.forEach(deleteUploadedFile);
      req.files = [];
      return res.status(validationError.includes("total de archivos") ? 413 : 400).json({ error: validationError });
    }
    return next();
  });
}

function publicCaseUpload(req, res, next) {
  if (!req.is("multipart/form-data")) return next();

  return upload.array("adjuntos", CASE_ATTACHMENT_MAX_FILES)(req, res, (err) => {
    if (err) return next(err);

    const files = req.files || [];
    const validationError = validateUploadedFiles(files);
    if (validationError) {
      files.forEach(deleteUploadedFile);
      req.files = [];
      return res.status(validationError.includes("total de archivos") ? 413 : 400).json({ error: validationError });
    }

    return next();
  });
}

function persistDb() {
  if (!db) return;
  const data = Buffer.from(db.export());
  const tmpPath = `${DB_PATH}.tmp`;
  const bakPath = `${DB_PATH}.bak`;
  const preservedBackup = fs.existsSync(bakPath);
  const previousPath = preservedBackup ? `${DB_PATH}.previous-${randomUUID()}` : bakPath;

  // Escritura atómica (aprox) en Windows:
  // 1) write tmp
  // 2) si existe DB, renombrar a .bak
  // 3) renombrar tmp a DB
  // 4) eliminar .bak
  fs.writeFileSync(tmpPath, data);
  if (fs.existsSync(DB_PATH)) {
    fs.renameSync(DB_PATH, previousPath);
  }

  try {
    fs.renameSync(tmpPath, DB_PATH);
  } catch (_e) {
    // Fallback: restaurar la DB anterior si existe.
    try {
      if (fs.existsSync(previousPath) && !fs.existsSync(DB_PATH)) {
        fs.renameSync(previousPath, DB_PATH);
      }
    } catch (_e2) {
      // noop
    }
    throw _e;
  }

  if (!fs.readFileSync(DB_PATH).equals(data)) throw new Error("SQLite persisted bytes differ from export");
  if (fs.existsSync(previousPath)) {
    try { fs.unlinkSync(previousPath); } catch (_e) { /* preserve recovery copy */ }
  }
}

let dbDirty = false;
let flushTimer = null;
let flushing = false;

function schedulePersistDb() {
  if (shuttingDown) return;
  dbDirty = true;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushPersistDb();
  }, DB_FLUSH_INTERVAL_MS);
}

function flushPersistDb() {
  if (!db || !dbDirty) return;
  if (flushing) return;
  flushing = true;
  try {
    persistDb();
    dbDirty = false;
  } catch (err) {
    console.error("DB FLUSH ERR:", err.message);
  } finally {
    flushing = false;
  }
}

function run(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.run(params);
  stmt.free();
  schedulePersistDb();
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      categoria TEXT,
      detalle TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS case_updates (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      author_id TEXT,
      mensaje TEXT NOT NULL,
      estado TEXT,
      prioridad TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_case_updates_case_id ON case_updates(case_id);
    CREATE TABLE IF NOT EXISTS enterprise_inquiries (
      id TEXT PRIMARY KEY,
      empresa TEXT NOT NULL,
      rubro TEXT NOT NULL,
      contacto TEXT NOT NULL,
      email TEXT NOT NULL,
      telefono TEXT,
      servicios TEXT,
      descripcion TEXT NOT NULL,
      volumen TEXT NOT NULL,
      comentarios TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS enterprise_retention_settings (
      enterprise_user_id TEXT PRIMARY KEY,
      retention_mode TEXT NOT NULL DEFAULT 'manual',
      retention_days INTEGER,
      updated_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(enterprise_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS auth_login_audit (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      email TEXT NOT NULL,
      ip TEXT NOT NULL,
      user_agent TEXT,
      success INTEGER NOT NULL DEFAULT 0,
      reason TEXT,
      attempts INTEGER,
      lock_until TEXT,
      request_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_auth_login_audit_created_at ON auth_login_audit(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_auth_login_audit_email ON auth_login_audit(email);
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      replaced_by_token_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_ip TEXT,
      user_agent TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
    CREATE TABLE IF NOT EXISTS security_events (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      event_type TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      success INTEGER NOT NULL DEFAULT 1,
      details TEXT,
      ip TEXT,
      user_agent TEXT,
      request_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS public_case_action_tokens (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      action TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      revoked_at TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE,
      FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_public_case_action_tokens_case_action
      ON public_case_action_tokens(case_id, action, expires_at);
    CREATE TABLE IF NOT EXISTS case_conversations (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL UNIQUE,
      enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
      pending_admin_attention INTEGER NOT NULL DEFAULT 0 CHECK (pending_admin_attention IN (0, 1)),
      client_reply_enabled INTEGER NOT NULL DEFAULT 0 CHECK (client_reply_enabled IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS case_service_offers (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      service_code TEXT NOT NULL CHECK (service_code IN ('professional-folder', 'rfa-management')),
      quoted_amount INTEGER NOT NULL CHECK (quoted_amount > 0),
      quoted_currency TEXT NOT NULL CHECK (quoted_currency IN ('ARS', 'USD')),
      quoted_scope TEXT NOT NULL,
      available_communication_modes TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL CHECK (status IN ('published', 'withdrawn')),
      created_by TEXT,
      created_at TEXT NOT NULL,
      published_at TEXT,
      withdrawn_at TEXT,
      FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE,
      FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_case_service_offers_case_status
      ON case_service_offers(case_id, status, created_at);
    CREATE TABLE IF NOT EXISTS case_payment_receipts (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      storage_filename TEXT NOT NULL UNIQUE,
      original_filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
      uploaded_at TEXT NOT NULL,
      verified_at TEXT,
      verified_by TEXT,
      status TEXT NOT NULL CHECK (status IN ('pending', 'verified', 'rejected', 'superseded')),
      FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE,
      FOREIGN KEY(verified_by) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_case_payment_receipts_case_uploaded
      ON case_payment_receipts(case_id, uploaded_at DESC);
    CREATE TABLE IF NOT EXISTS case_conversation_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL,
      sender_type TEXT NOT NULL CHECK (sender_type IN ('rfa', 'client')),
      message_type TEXT NOT NULL CHECK (message_type IN ('prepared_message', 'received_reply')),
      body TEXT NOT NULL,
      channel TEXT,
      author_user_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(conversation_id) REFERENCES case_conversations(id) ON DELETE CASCADE,
      FOREIGN KEY(author_user_id) REFERENCES users(id) ON DELETE SET NULL,
      CHECK ((sender_type = 'rfa' AND message_type = 'prepared_message') OR
             (sender_type = 'client' AND message_type = 'received_reply'))
    );
    CREATE TABLE IF NOT EXISTS case_conversation_attachments (
      id TEXT PRIMARY KEY,
      message_id INTEGER NOT NULL,
      storage_filename TEXT NOT NULL UNIQUE,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
      created_at TEXT NOT NULL,
      FOREIGN KEY(message_id) REFERENCES case_conversation_messages(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS case_conversation_access_tokens (
      token_hash TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(conversation_id) REFERENCES case_conversations(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_case_conversation_messages_thread
      ON case_conversation_messages(conversation_id, created_at, id);
    CREATE INDEX IF NOT EXISTS idx_case_conversation_attachments_message
      ON case_conversation_attachments(message_id);
    CREATE INDEX IF NOT EXISTS idx_case_conversation_tokens_thread_expiry
      ON case_conversation_access_tokens(conversation_id, expires_at);
    CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
  `);
  const conversationColumns = all("PRAGMA table_info(case_conversations)").map((column) => column.name);
  if (!conversationColumns.includes("client_reply_enabled")) {
    db.exec("ALTER TABLE case_conversations ADD COLUMN client_reply_enabled INTEGER NOT NULL DEFAULT 0 CHECK (client_reply_enabled IN (0, 1))");
    for (const conversation of all("SELECT id, enabled FROM case_conversations WHERE enabled = 1")) {
      const latestMessage = get(
        "SELECT sender_type FROM case_conversation_messages WHERE conversation_id = ? ORDER BY created_at DESC, id DESC LIMIT 1",
        [conversation.id]
      );
      run("UPDATE case_conversations SET client_reply_enabled = ? WHERE id = ?", [latestMessage?.sender_type === "client" ? 0 : 1, conversation.id]);
    }
  }
  const columns = all("PRAGMA table_info(cases)").map((c) => c.name);
  const addColumn = (name, type) => {
    if (!columns.includes(name)) {
      db.exec(`ALTER TABLE cases ADD COLUMN ${name} ${type};`);
    }
  };
  addColumn("nombre_completo", "TEXT");
  addColumn("dni_cuit", "TEXT");
  addColumn("email_contacto", "TEXT");
  addColumn("telefono", "TEXT");
  addColumn("entidad", "TEXT");
  addColumn("tipo_entidad", "TEXT");
  addColumn("monto_valor", "TEXT");
  addColumn("monto_escala", "TEXT");
  addColumn("monto_moneda", "TEXT");
  addColumn("medios_pago", "TEXT");
  addColumn("relato", "TEXT");
  addColumn("autorizacion", "INTEGER");
  addColumn("terms_accepted", "INTEGER DEFAULT 0");
  addColumn("privacy_accepted", "INTEGER DEFAULT 0");
  addColumn("consent_version", "TEXT");
  addColumn("consent_accepted_at", "TEXT");
  addColumn("adjuntos", "TEXT");
  addColumn("plan_elegido", "TEXT");
  addColumn("case_code", "TEXT");
  addColumn("empresa", "TEXT");
  addColumn("prioridad", "TEXT");
  addColumn("fecha_caso", "TEXT");
  addColumn("canal_origen", "TEXT");
  addColumn("enterprise_user_id", "TEXT");
  addColumn("riesgo", "TEXT");
  addColumn("documentacion_estado", "TEXT");
  addColumn("observaciones_empresa", "TEXT");
  addColumn("observaciones_rfa", "TEXT");
  addColumn("payment_receipt_filename", "TEXT");
  addColumn("payment_receipt_original_name", "TEXT");
  addColumn("payment_receipt_uploaded_at", "TEXT");
  addColumn("service_code", "TEXT");
  addColumn("quoted_amount", "INTEGER");
  addColumn("quoted_currency", "TEXT DEFAULT 'ARS'");
  addColumn("quoted_scope", "TEXT");
  addColumn("commercial_status", "TEXT");
  addColumn("quoted_at", "TEXT");
  addColumn("proposal_accepted_at", "TEXT");
  addColumn("communication_mode", "TEXT");
  addColumn("accepted_proposal_snapshot", "TEXT");
  addColumn("payment_confirmed_at", "TEXT");
  addColumn("commercial_flow_version", "INTEGER NOT NULL DEFAULT 1");
  addColumn("selected_offer_id", "TEXT");
  addColumn("customer_communication_mode", "TEXT");
  for (const legacyReceipt of all("SELECT id, case_code, payment_receipt_filename, payment_receipt_original_name, payment_receipt_uploaded_at FROM cases WHERE payment_receipt_filename IS NOT NULL AND trim(payment_receipt_filename) <> ''")) {
    const exists = get("SELECT id FROM case_payment_receipts WHERE storage_filename = ?", [path.basename(legacyReceipt.payment_receipt_filename)]);
    if (exists) continue;
    const filename = path.basename(legacyReceipt.payment_receipt_filename);
    const filePath = path.join(UPLOADS_DIR, filename);
    let size = 0;
    try { size = fs.statSync(filePath).size; } catch { /* keep metadata even if legacy file is missing */ }
    run(
      `INSERT INTO case_payment_receipts
       (id, case_id, storage_filename, original_filename, mime_type, size_bytes, uploaded_at, status)
       VALUES (?, ?, ?, ?, 'application/octet-stream', ?, ?, 'pending')`,
      [randomUUID(), legacyReceipt.id, filename, cleanText(legacyReceipt.payment_receipt_original_name, 255) || `comprobante_${legacyReceipt.case_code || legacyReceipt.id}`, size, legacyReceipt.payment_receipt_uploaded_at || new Date().toISOString()]
    );
  }
  const updatesColumns = all("PRAGMA table_info(case_updates)").map((c) => c.name);
  if (!updatesColumns.includes("prioridad")) {
    db.exec("ALTER TABLE case_updates ADD COLUMN prioridad TEXT;");
  }
  if (!updatesColumns.includes("visibility")) {
    db.exec("ALTER TABLE case_updates ADD COLUMN visibility TEXT DEFAULT 'public';");
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_cases_enterprise_user_id ON cases(enterprise_user_id);");
  db.exec("CREATE INDEX IF NOT EXISTS idx_cases_case_code ON cases(case_code);");
  const userColumns = all("PRAGMA table_info(users)").map((c) => c.name);
  const addUserColumn = (name, type) => {
    if (!userColumns.includes(name)) {
      db.exec(`ALTER TABLE users ADD COLUMN ${name} ${type};`);
    }
  };
  addUserColumn("email_verified", "INTEGER DEFAULT 0");
  const enterpriseInquiryColumns = all("PRAGMA table_info(enterprise_inquiries)").map((c) => c.name);
  const addEnterpriseInquiryColumn = (name, type) => {
    if (!enterpriseInquiryColumns.includes(name)) {
      db.exec(`ALTER TABLE enterprise_inquiries ADD COLUMN ${name} ${type};`);
    }
  };
  addEnterpriseInquiryColumn("privacy_accepted", "INTEGER DEFAULT 0");
  addEnterpriseInquiryColumn("consent_version", "TEXT");
  addEnterpriseInquiryColumn("consent_accepted_at", "TEXT");
  const enterpriseRetentionColumns = all("PRAGMA table_info(enterprise_retention_settings)").map((c) => c.name);
  if (!enterpriseRetentionColumns.includes("updated_at")) {
    db.exec("ALTER TABLE enterprise_retention_settings ADD COLUMN updated_at TEXT;");
  }
  run(
    `UPDATE enterprise_retention_settings
     SET retention_mode = 'manual', retention_days = NULL
     WHERE retention_mode NOT IN ('manual', 'auto')`
  );
  run(
    `UPDATE enterprise_retention_settings
     SET retention_days = NULL
     WHERE retention_mode = 'manual'`
  );
  run(
    `UPDATE enterprise_retention_settings
     SET retention_days = 90
     WHERE retention_mode = 'auto' AND (retention_days IS NULL OR retention_days NOT IN (30, 60, 90))`
  );
  run(
    `UPDATE enterprise_retention_settings
     SET updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
     WHERE updated_at IS NULL OR TRIM(updated_at) = ''`
  );
  run("UPDATE users SET email_verified = 1 WHERE email_verified IS NULL");
  run("DELETE FROM refresh_tokens WHERE expires_at <= CURRENT_TIMESTAMP OR revoked_at IS NOT NULL");
  persistDb();
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isAccepted(value) {
  return value === true || String(value || "").trim().toLowerCase() === "true";
}

function isValidEmail(value) {
  if (!isNonEmptyString(value)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isStrongPassword(value) {
  if (!isNonEmptyString(value)) return false;
  const pwd = value.trim();
  if (pwd.length < 8 || pwd.length > 72) return false;
  const hasLetter = /[A-Za-z]/.test(pwd);
  const hasNumber = /\d/.test(pwd);
  return hasLetter && hasNumber;
}


function generateEnterprisePassword() {
  // Strong random password: uppercase, lowercase, numbers and symbols
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%*-_";
  const all = upper + lower + numbers + symbols;
  const pick = (chars) => chars[randomInt(chars.length)];
  const chars = [pick(upper), pick(lower), pick(numbers), pick(symbols)];
  while (chars.length < 14) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function cleanText(value, max = 1000) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, max);
}

function normalizeCompareText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEnterpriseRetentionInput(payload = {}) {
  const mode = String(payload.retention_mode || "").trim().toLowerCase();
  if (!["manual", "auto"].includes(mode)) {
    return { ok: false, error: "retention_mode invalido. Usa manual o auto" };
  }
  if (mode === "manual") {
    return { ok: true, mode: "manual", days: null };
  }
  const daysRaw = typeof payload.retention_days === "number"
    ? payload.retention_days
    : Number(String(payload.retention_days || "").trim());
  if (![30, 60, 90].includes(daysRaw)) {
    return { ok: false, error: "retention_days invalido. Usa 30, 60 o 90" };
  }
  return { ok: true, mode: "auto", days: daysRaw };
}

function getEnterpriseRetentionSettings(enterpriseUserId) {
  const row = get(
    `SELECT enterprise_user_id, retention_mode, retention_days, updated_at
     FROM enterprise_retention_settings
     WHERE enterprise_user_id = ?`,
    [enterpriseUserId]
  );
  if (!row) {
    return {
      enterprise_user_id: enterpriseUserId,
      retention_mode: "manual",
      retention_days: null,
      updated_at: null
    };
  }
  const mode = row.retention_mode === "auto" ? "auto" : "manual";
  const days = mode === "auto" && [30, 60, 90].includes(Number(row.retention_days))
    ? Number(row.retention_days)
    : null;
  return {
    enterprise_user_id: enterpriseUserId,
    retention_mode: mode,
    retention_days: days,
    updated_at: row.updated_at || null
  };
}

function parseAttachmentFilenames(adjuntosValue) {
  if (!adjuntosValue) return [];
  try {
    const parsed = JSON.parse(adjuntosValue);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => path.basename(String(entry?.filename || "").trim()))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function deleteUploadedFile(file) {
  const filename = path.basename(String(file?.filename || "").trim());
  if (!filename) return;
  const filePath = path.join(UPLOADS_DIR, filename);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error("UPLOAD CLEANUP ERR:", filename, err.message);
    }
  }
}

function readFilePart(filePath, position, length) {
  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(length);
    const bytesRead = fs.readSync(fd, buffer, 0, length, position);
    return buffer.subarray(0, bytesRead);
  } finally {
    fs.closeSync(fd);
  }
}

function inspectZipEntries(filePath) {
  const fileSize = fs.statSync(filePath).size;
  const tailSize = Math.min(fileSize, 65557);
  const tail = readFilePart(filePath, fileSize - tailSize, tailSize);
  let eocd = -1;
  for (let i = tail.length - 22; i >= Math.max(0, tail.length - 65557); i -= 1) {
    if (tail.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0 || eocd + 22 > tail.length) return null;
  if (tail.readUInt16LE(eocd + 4) !== 0 || tail.readUInt16LE(eocd + 6) !== 0) return null;
  const entries = tail.readUInt16LE(eocd + 10);
  const directorySize = tail.readUInt32LE(eocd + 12);
  const directoryOffset = tail.readUInt32LE(eocd + 16);
  if (!entries || entries > 10000 || directorySize > 2 * 1024 * 1024 || directoryOffset + directorySize > fileSize) return null;

  const directory = readFilePart(filePath, directoryOffset, directorySize);
  const names = new Set();
  let offset = 0;
  let uncompressedTotal = 0;
  for (let i = 0; i < entries; i += 1) {
    if (offset + 46 > directory.length || directory.readUInt32LE(offset) !== 0x02014b50) return null;
    const flags = directory.readUInt16LE(offset + 8);
    const compressedSize = directory.readUInt32LE(offset + 20);
    const uncompressedSize = directory.readUInt32LE(offset + 24);
    const nameLength = directory.readUInt16LE(offset + 28);
    const extraLength = directory.readUInt16LE(offset + 30);
    const commentLength = directory.readUInt16LE(offset + 32);
    const nextOffset = offset + 46 + nameLength + extraLength + commentLength;
    if ((flags & 1) !== 0 || nextOffset > directory.length) return null;
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) return null;
    if (uncompressedSize > 100 * 1024 * 1024) return null;
    if (compressedSize === 0 ? uncompressedSize > 0 : uncompressedSize / compressedSize > 200) return null;
    uncompressedTotal += uncompressedSize;
    if (uncompressedTotal > 64 * 1024 * 1024) return null;
    names.add(directory.toString("utf8", offset + 46, offset + 46 + nameLength));
    offset = nextOffset;
  }
  return names;
}

function validateTextFile(filePath) {
  const sample = readFilePart(filePath, 0, Math.min(fs.statSync(filePath).size, 8192));
  if (sample.includes(0)) return false;
  let controls = 0;
  for (const byte of sample) {
    if ((byte < 0x20 && ![0x09, 0x0a, 0x0d].includes(byte)) || byte === 0x7f) controls += 1;
  }
  return sample.length === 0 || controls / sample.length <= 0.01;
}

function validateUploadedFileContent(file, { importFile = false } = {}) {
  const ext = path.extname(String(file?.originalname || "")).toLowerCase();
  const filePath = file?.path;
  if (!filePath || !fs.existsSync(filePath)) return false;
  if (ext === ".pdf") return readFilePart(filePath, 0, Math.min(1024, fs.statSync(filePath).size)).includes(Buffer.from("%PDF-"));
  if (ext === ".png") return readFilePart(filePath, 0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (ext === ".jpg" || ext === ".jpeg") return readFilePart(filePath, 0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (ext === ".doc") return readFilePart(filePath, 0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  if (ext === ".docx") {
    const entries = inspectZipEntries(filePath);
    return Boolean(entries?.has("[Content_Types].xml") && entries.has("word/document.xml"));
  }
  if (ext === ".xlsx") return Boolean(inspectZipEntries(filePath)?.has("xl/workbook.xml"));
  if (ext === ".txt" || (importFile && ext === ".csv")) return validateTextFile(filePath);
  return false;
}

function validateUploadedFiles(files, { totalLimit = PUBLIC_CASE_ATTACHMENT_MAX_TOTAL_BYTES, importFile = false } = {}) {
  const uploaded = Array.isArray(files) ? files : [];
  const totalBytes = uploaded.reduce((sum, file) => sum + (Number(file?.size) || 0), 0);
  if (totalBytes > totalLimit) return "El total de archivos supera el límite permitido.";
  for (const file of uploaded) {
    if (!validateUploadedFileContent(file, { importFile })) {
      const displayName = cleanText(path.basename(String(file.originalname || "archivo")), 120);
      return `El contenido del archivo ${displayName || "seleccionado"} no coincide con su formato.`;
    }
  }
  return "";
}

function deleteCaseAttachments(rows = []) {
  rows.forEach((row) => {
    const deletedReceiptFiles = new Set();
    parseAttachmentFilenames(row?.adjuntos).forEach((filename) => {
      const filePath = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error("PURGE ATTACHMENT ERR:", filename, err.message);
        }
      }
    });
    const paymentReceiptFilename = path.basename(String(row?.payment_receipt_filename || "").trim());
    if (paymentReceiptFilename) deletedReceiptFiles.add(paymentReceiptFilename);
    all("SELECT storage_filename FROM case_payment_receipts WHERE case_id = ?", [row.id]).forEach((receipt) => {
      const filename = path.basename(String(receipt.storage_filename || ""));
      if (filename) deletedReceiptFiles.add(filename);
    });
    deletedReceiptFiles.forEach((filename) => {
      const paymentReceiptPath = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(paymentReceiptPath)) {
        try {
          fs.unlinkSync(paymentReceiptPath);
        } catch (err) {
          console.error("PURGE PAYMENT RECEIPT ERR:", filename, err.message);
        }
      }
    });
  });
}

function purgeExpiredClosedCases() {
  const details = {
    userRetentionDays: USER_RETENTION_DAYS,
    deletedUserCases: 0,
    deletedEnterpriseCases: 0
  };

  const userRows = all(
    `SELECT id, adjuntos, payment_receipt_filename
     FROM cases
     WHERE estado = 'Cerrado'
       AND enterprise_user_id IS NULL
       AND datetime(updated_at) <= datetime('now', ?)` ,
    [`-${USER_RETENTION_DAYS} day`]
  );

  const enterpriseRows = all(
    `SELECT c.id, c.adjuntos, c.payment_receipt_filename
     FROM cases c
     JOIN enterprise_retention_settings ers ON ers.enterprise_user_id = c.enterprise_user_id
     WHERE c.estado = 'Cerrado'
       AND ers.retention_mode = 'auto'
       AND ers.retention_days IN (30, 60, 90)
       AND datetime(c.updated_at) <= datetime('now', printf('-%d day', ers.retention_days))`
  );

  if (userRows.length) {
    deleteConversationAttachmentsForCases(userRows);
    deleteCaseAttachments(userRows);
    userRows.forEach((row) => run("DELETE FROM cases WHERE id = ?", [row.id]));
    details.deletedUserCases = userRows.length;
  }

  if (enterpriseRows.length) {
    deleteConversationAttachmentsForCases(enterpriseRows);
    deleteCaseAttachments(enterpriseRows);
    enterpriseRows.forEach((row) => run("DELETE FROM cases WHERE id = ?", [row.id]));
    details.deletedEnterpriseCases = enterpriseRows.length;
  }

  return details;
}

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(72),
  account_type: z.string().trim().optional()
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(200),
  account_type: z.string().trim().optional()
});

const enterpriseInquirySchema = z.object({
  empresa: z.string().trim().min(2).max(120),
  rubro: z.string().trim().min(2).max(120),
  contacto: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  telefono: z.union([z.string().trim().max(60), z.null(), z.undefined()]),
  servicios: z.union([z.string(), z.array(z.string()), z.null(), z.undefined()]),
  descripcion: z.string().trim().min(5).max(4000),
  volumen: z.string().trim().min(1).max(60),
  comentarios: z.union([z.string().trim().max(2000), z.null(), z.undefined()]),
  acepta_privacidad: z.union([z.boolean(), z.string()])
});


const enterpriseUserCreateSchema = z.object({
  email: z.string().trim().email(),
  password: z.union([z.string().min(8).max(72), z.null(), z.undefined()])
});

const publicCaseLookupSchema = z.object({
  case_id: z.string().trim().min(6).max(80),
  identifier: z.string().trim().min(3).max(180)
});

const publicProposalAcceptSchema = publicCaseLookupSchema.extend({
  action_token: z.string().min(64).max(128),
  offer_id: z.string().trim().min(1).max(80).optional(),
  communication_mode: z.string().trim().max(40).nullable().optional()
});
const publicPaymentReceiptSchema = publicCaseLookupSchema.extend({ action_token: z.string().min(64).max(128) });
const publicActionTokenIssueSchema = z.object({ action: z.enum(["proposal_accept", "payment_receipt"]) });
const publicCaseActionGrantSchema = publicCaseLookupSchema.extend({ action: z.enum(["proposal_accept", "payment_receipt"]) });

const caseCreateSchema = z.object({
  categoria: z.union([z.string().trim().max(120), z.null(), z.undefined()]),
  nombre_completo: z.union([z.string().trim().max(120), z.null(), z.undefined()]),
  dni_cuit: z.union([z.string().trim().max(40), z.null(), z.undefined()]),
  email_contacto: z.union([z.string().trim().email(), z.null(), z.undefined(), z.literal("")]),
  telefono: z.union([z.string().trim().max(60), z.null(), z.undefined()]),
  entidad: z.union([z.string().trim().max(160), z.null(), z.undefined()]),
  tipo_entidad: z.union([z.string().trim().max(160), z.null(), z.undefined()]),
  monto_valor: z.union([z.string().trim().max(40), z.null(), z.undefined()]),
  monto_escala: z.union([z.string().trim().max(40), z.null(), z.undefined()]),
  monto_moneda: z.union([z.string().trim().max(20), z.null(), z.undefined()]),
  medios_pago: z.any().optional(),
  relato: z.union([z.string().trim().max(4000), z.null(), z.undefined()]),
  autorizacion: z.union([z.boolean(), z.string(), z.null(), z.undefined()]),
  acepta_terminos: z.union([z.boolean(), z.string(), z.null(), z.undefined()]),
  acepta_privacidad: z.union([z.boolean(), z.string(), z.null(), z.undefined()]),
  plan_elegido: z.union([z.string().trim().max(120), z.null(), z.undefined()]),
  detalle: z.union([z.string().trim().max(4000), z.null(), z.undefined()])
});

const publicCaseCreateSchema = caseCreateSchema.superRefine((data, ctx) => {
  const requiredFields = [
    ["nombre_completo", "Debes indicar tu nombre completo"],
    ["email_contacto", "Debes indicar un correo electrónico válido"],
    ["entidad", "Debes indicar la empresa o proveedor reclamado"],
    ["categoria", "Debes seleccionar una categoría"],
    ["relato", "Debes describir el reclamo"]
  ];
  requiredFields.forEach(([field, message]) => {
    if (!isNonEmptyString(data?.[field])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message
      });
    }
  });
  if (!isAccepted(data?.acepta_terminos)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["acepta_terminos"],
      message: "Debes aceptar los Términos y Condiciones"
    });
  }
  if (!isAccepted(data?.acepta_privacidad)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["acepta_privacidad"],
      message: "Debes aceptar la Política de Privacidad"
    });
  }
});

const caseUpdateSchema = z.object({
  mensaje: z.union([z.string().trim().max(3000), z.null(), z.undefined()]),
  estado: z.union([z.string().trim().max(120), z.null(), z.undefined()]),
  plan_elegido: z.union([z.string().trim().max(120), z.null(), z.undefined()]),
  service_code: z.union([z.string().trim().max(80), z.null(), z.undefined()]),
  quoted_amount: z.union([z.number(), z.string().trim().max(30), z.null(), z.undefined()]),
  quoted_currency: z.union([z.string().trim().max(8), z.null(), z.undefined()]),
  quoted_scope: z.union([z.string().trim().max(4000), z.null(), z.undefined()]),
  commercial_status: z.union([z.string().trim().max(40), z.null(), z.undefined()]),
  communication_mode: z.union([z.string().trim().max(40), z.null(), z.undefined()]),
  message_visibility: z.union([z.enum(["public", "rfa_internal"]), z.null(), z.undefined()]),
  prioridad: z.union([z.string().trim().max(20), z.null(), z.undefined()]),
  riesgo: z.union([z.string().trim().max(20), z.null(), z.undefined()]),
  documentacion_estado: z.union([z.string().trim().max(40), z.null(), z.undefined()]),
  observaciones_empresa: z.union([z.string().trim().max(3000), z.null(), z.undefined()]),
  observaciones_rfa: z.union([z.string().trim().max(3000), z.null(), z.undefined()]),
  descripcion_breve: z.union([z.string().trim().max(4000), z.null(), z.undefined()])
});
const serviceOfferPublicationSchema = z.object({
  offers: z.array(z.object({
    service_code: z.enum(["professional-folder", "rfa-management"]),
    quoted_amount: z.union([z.number(), z.string().trim().max(30)]),
    quoted_currency: z.enum(["ARS", "USD"]),
    quoted_scope: z.string().trim().min(1).max(4000),
    available_communication_modes: z.array(z.enum(["rfa_managed", "client_sends"])).max(2).default([])
  })).min(1).max(2)
});

const conversationSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  client_reply_enabled: z.boolean().optional()
}).refine((settings) => settings.enabled !== undefined || settings.client_reply_enabled !== undefined);
const conversationMessageSchema = z.object({
  body: z.string().trim().max(6000).optional().default(""),
  channel: z.union([z.string().trim().max(160), z.null(), z.undefined()])
});

const enterpriseRetentionSchema = z.object({
  retention_mode: z.string().trim().toLowerCase(),
  retention_days: z.union([z.number(), z.string(), z.null(), z.undefined()])
});

function findPublicCaseByLookup(caseIdRaw, identifierRaw) {
  const caseId = String(caseIdRaw || "").trim();
  const identifier = String(identifierRaw || "").trim();
  if (!caseId || !identifier) return null;

  const caso = get(
    `SELECT
      c.id, c.case_code, c.estado, c.categoria, c.entidad, c.plan_elegido, c.service_code,
      c.quoted_amount, c.quoted_currency, c.quoted_scope, c.commercial_status,
      c.communication_mode, c.accepted_proposal_snapshot,
      c.commercial_flow_version, c.selected_offer_id, c.customer_communication_mode,
      c.quoted_at, c.proposal_accepted_at, c.payment_confirmed_at, c.created_at, c.updated_at,
      c.dni_cuit, c.email_contacto, c.payment_receipt_uploaded_at, c.payment_receipt_filename,
      COALESCE(c.email_contacto, u.email) AS owner_email
     FROM cases c
     JOIN users u ON u.id = c.user_id
     WHERE (c.id = ? OR c.case_code = ?)
       AND c.enterprise_user_id IS NULL`,
    [caseId, caseId]
  );

  if (!caso) return null;
  const normalizedIdentifier = identifier.toLowerCase();
  const ownerEmail = String(caso.owner_email || "").trim().toLowerCase();
  const ownerDni = String(caso.dni_cuit || "").trim();
  const hasContactEmail = String(caso.email_contacto || "").trim().length > 0;
  const emailMatches = ownerEmail && ownerEmail === normalizedIdentifier;
  const dniMatches = !hasContactEmail && ownerDni && ownerDni === identifier;
  if (!emailMatches && !dniMatches) return null;

  return caso;
}

function getConversationForCase(caseId) {
  return get("SELECT * FROM case_conversations WHERE case_id = ?", [caseId]);
}

function getConversationPayload(conversation) {
  if (!conversation) return { enabled: false, client_reply_enabled: false, pending_admin_attention: false, messages: [] };
  const messages = all(
    `SELECT id, sender_type, message_type, body, channel, created_at
     FROM case_conversation_messages
     WHERE conversation_id = ?
     ORDER BY created_at ASC, id ASC`,
    [conversation.id]
  ).map((message) => ({
    ...message,
    attachments: all(
      `SELECT id, original_name, mime_type, size_bytes, created_at
       FROM case_conversation_attachments
       WHERE message_id = ?
       ORDER BY created_at ASC, id ASC`,
      [message.id]
    )
  }));
  return {
    enabled: Boolean(conversation.enabled),
    client_reply_enabled: Boolean(conversation.client_reply_enabled),
    pending_admin_attention: Boolean(conversation.pending_admin_attention),
    messages
  };
}

function getPublicConversationPayload(conversation) {
  const payload = getConversationPayload(conversation);
  return { enabled: payload.enabled, client_reply_enabled: payload.client_reply_enabled, messages: payload.messages };
}

function conversationNoStore(_req, res, next) {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("Pragma", "no-cache");
  return next();
}

function conversationTokenRequired(req, res, next) {
  const token = String(req.get("X-RFA-Conversation-Token") || "");
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return res.status(404).json({ error: "Conversación no disponible" });
  }
  const tokenRow = get(
    `SELECT token_hash, expires_at, conversation_id
     FROM case_conversation_access_tokens
     WHERE token_hash = ?`,
    [hashConversationAccessToken(token)]
  );
  if (!tokenRow || !isConversationAccessTokenActive(token, tokenRow.token_hash, tokenRow.expires_at)) {
    return res.status(404).json({ error: "Conversación no disponible" });
  }
  const conversation = get(
    `SELECT cc.id, cc.case_id, cc.enabled
     FROM case_conversations cc
     JOIN cases c ON c.id = cc.case_id
     WHERE cc.id = ? AND c.enterprise_user_id IS NULL`,
    [tokenRow.conversation_id]
  );
  if (!conversation?.enabled) {
    return res.status(404).json({ error: "Conversación no disponible" });
  }
  req.conversation = conversation;
  return next();
}

function individualAdminConversationCase(req, res, next) {
  const caso = get("SELECT id, enterprise_user_id FROM cases WHERE id = ?", [req.params.id]);
  if (!caso || caso.enterprise_user_id) {
    return res.status(404).json({ error: "Caso no encontrado" });
  }
  req.conversationCase = caso;
  return next();
}

function persistConversationAttachments(messageId, files, now) {
  (files || []).forEach((file) => {
    run(
      `INSERT INTO case_conversation_attachments
       (id, message_id, storage_filename, original_name, mime_type, size_bytes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        messageId,
        path.basename(String(file.filename || "")),
        cleanText(path.basename(String(file.originalname || "adjunto")), 255) || "adjunto",
        cleanText(file.mimetype, 120) || "application/octet-stream",
        Number(file.size) || 0,
        now
      ]
    );
  });
}

function deleteConversationAttachmentsForCases(caseRows = []) {
  caseRows.forEach((row) => {
    const conversation = get("SELECT id FROM case_conversations WHERE case_id = ?", [row.id]);
    if (!conversation) return;
    const files = all(
      `SELECT a.storage_filename AS filename
       FROM case_conversation_messages m
       JOIN case_conversation_attachments a ON a.message_id = m.id
       WHERE m.conversation_id = ?`,
      [conversation.id]
    );
    files.forEach(deleteUploadedFile);
    runInTransaction(() => {
      run("DELETE FROM case_conversation_access_tokens WHERE conversation_id = ?", [conversation.id]);
      run("DELETE FROM case_conversation_attachments WHERE message_id IN (SELECT id FROM case_conversation_messages WHERE conversation_id = ?)", [conversation.id]);
      run("DELETE FROM case_conversation_messages WHERE conversation_id = ?", [conversation.id]);
      run("DELETE FROM case_conversations WHERE id = ?", [conversation.id]);
    });
  });
}

function normalizeQuotedAmount(value) {
  if (value === undefined) return { provided: false, value: undefined };
  if (value === null || String(value).trim() === "") return { provided: true, value: null };
  const normalized = typeof value === "number"
    ? value
    : Number(String(value).replace(/[$.\s]/g, "").replace(",", "."));
  if (!Number.isSafeInteger(normalized) || normalized < 1 || normalized > 1_000_000_000_000) {
    return { provided: true, error: "El precio debe ser un importe entero positivo en ARS" };
  }
  return { provided: true, value: normalized };
}

function getStoredServiceCode(caso) {
  return cleanText(caso?.service_code, 80) || cleanText(caso?.plan_elegido, 120) || null;
}

function getCaseServiceOffers(caseId, { publishedOnly = false } = {}) {
  const rows = all(
    `SELECT id, case_id, service_code, quoted_amount, quoted_currency, quoted_scope,
            available_communication_modes, status, created_at, published_at, withdrawn_at
     FROM case_service_offers
     WHERE case_id = ? ${publishedOnly ? "AND status = 'published'" : ""}
     ORDER BY created_at ASC, id ASC`,
    [caseId]
  );
  return rows.map((offer) => {
    let modes = [];
    try { modes = JSON.parse(offer.available_communication_modes || "[]"); } catch { modes = []; }
    return { ...offer, available_communication_modes: Array.isArray(modes) ? modes : [] };
  });
}

function getCasePaymentReceipts(caseId) {
  return all(
    `SELECT id, case_id, original_filename, mime_type, size_bytes, uploaded_at, verified_at, verified_by, status
     FROM case_payment_receipts WHERE case_id = ? ORDER BY uploaded_at DESC, rowid DESC`,
    [caseId]
  );
}

function getEffectiveCommercialStatus(caso) {
  const explicit = cleanText(caso?.commercial_status, 40);
  if (explicit && COMMERCIAL_STATUSES.has(explicit)) return explicit;
  const legacyStatus = normalizeCompareText(caso?.estado);
  const legacyService = normalizeCompareText(caso?.plan_elegido);
  const legacyPaidService = legacyService && legacyService !== "analysis" && legacyService !== "analisis inicial";
  if (legacyPaidService && legacyStatus === "viable (pendiente de pago)") return "payment_pending";
  return "analysis";
}

function getLatestPublicOperationalStatus(caseId) {
  return get(
    `SELECT estado FROM case_updates
     WHERE case_id = ? AND visibility = 'public' AND estado IS NOT NULL
     ORDER BY created_at DESC, rowid DESC LIMIT 1`,
    [caseId]
  )?.estado || "received";
}

function getPersonaV2OperationalStage(caso) {
  if (!caso || caso.enterprise_user_id || Number(caso.commercial_flow_version) < 2) return null;

  const operationalStatus = String(
    caso.operational_status_for_stage || caso.estado || caso.latest_public_operational_status || getLatestPublicOperationalStatus(caso.id)
  );
  const terminalStages = {
    completed: "Finalizado",
    referred: "Derivado",
    not_applicable: "No corresponde"
  };
  if (terminalStages[operationalStatus]) return terminalStages[operationalStatus];

  const commercialStatus = getEffectiveCommercialStatus(caso);
  if (commercialStatus === "paid") return "En gestión";
  if (commercialStatus === "payment_pending") {
    return caso.payment_receipt_pending || caso.payment_receipt_uploaded_at
      ? "Comprobante recibido / verificación de pago"
      : "Pendiente de pago";
  }
  if (commercialStatus === "proposal_sent") return "Opciones disponibles";

  switch (operationalStatus) {
    case "in_analysis": return "En análisis";
    case "needs_information": return "Falta información";
    case "in_progress": return "En gestión";
    default: return "Recibido";
  }
}

function addPersonaV2OperationalStage(caso) {
  if (!caso) return caso;
  const stage = getPersonaV2OperationalStage(caso);
  return stage ? { ...caso, operational_stage: stage } : caso;
}

function addPersonaV2OperationalStageForRole(caso, role) {
  if (!caso || role === "admin") return addPersonaV2OperationalStage(caso);
  return addPersonaV2OperationalStage({
    ...caso,
    operational_status_for_stage: caso.latest_public_operational_status || "received"
  });
}

function hasVisibleProposal(caso) {
  return ["proposal_sent", "accepted", "payment_pending", "paid"].includes(getEffectiveCommercialStatus(caso));
}

function sanitizeCaseForRole(caso, role) {
  if (!caso || role === "admin") return caso;
  const sanitized = { ...caso };
  delete sanitized.observaciones_rfa;
  if (role === "enterprise") {
    delete sanitized.plan_elegido;
    delete sanitized.service_code;
    delete sanitized.quoted_amount;
    delete sanitized.quoted_currency;
    delete sanitized.quoted_scope;
    delete sanitized.commercial_status;
    delete sanitized.communication_mode;
    delete sanitized.accepted_proposal_snapshot;
    delete sanitized.quoted_at;
    delete sanitized.proposal_accepted_at;
    delete sanitized.payment_confirmed_at;
    delete sanitized.payment_receipt_filename;
    delete sanitized.payment_receipt_original_name;
    delete sanitized.payment_receipt_uploaded_at;
  }
  return sanitized;
}

function validateBody(schema, payload) {
  const parsed = schema.safeParse(payload || {});
  if (!parsed.success) {
    const first = parsed.error.issues?.[0];
    const field = first?.path?.[0] ? String(first.path[0]) : "payload";
    return { ok: false, error: `Campo invalido: ${field}` };
  }
  return { ok: true, data: parsed.data };
}

function hashRefreshToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function hashPublicActionToken(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

function getActivePublicActionToken(token, caseId, action) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) return null;
  return get(
    `SELECT id FROM public_case_action_tokens
     WHERE case_id = ? AND action = ? AND token_hash = ?
       AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ?`,
    [caseId, action, hashPublicActionToken(token), new Date().toISOString()]
  );
}

function hasExactPublicEmailMatch(caso, identifier) {
  const submittedEmail = String(identifier || "").trim();
  const caseEmail = String(caso?.owner_email || "").trim();
  return submittedEmail.includes("@") && caseEmail.toLowerCase() === submittedEmail.toLowerCase();
}

function issuePublicCaseActionToken(caseId, action) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  runInTransaction(() => {
    run(
      `UPDATE public_case_action_tokens
       SET revoked_at = CURRENT_TIMESTAMP
       WHERE case_id = ? AND action = ? AND used_at IS NULL AND revoked_at IS NULL`,
      [caseId, action]
    );
    run(
      `INSERT INTO public_case_action_tokens (id, case_id, action, token_hash, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [randomUUID(), caseId, action, hashPublicActionToken(token), expiresAt]
    );
  });
  return { token, expires_at: expiresAt };
}

function runInTransaction(callback) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = callback();
    db.exec("COMMIT");
    schedulePersistDb();
    return result;
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* keep the original error */ }
    throw error;
  }
}

function runAndCount(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.run(params);
  const changed = db.getRowsModified();
  stmt.free();
  return changed;
}

function getRefreshCookieOptions() {
  const sameSiteRaw = String(REFRESH_TOKEN_SAME_SITE || "lax").toLowerCase();
  const sameSite = ["lax", "strict", "none"].includes(sameSiteRaw) ? sameSiteRaw : "lax";
  return {
    httpOnly: true,
    secure: REFRESH_TOKEN_SECURE_COOKIE,
    sameSite,
    path: "/",
    maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
  };
}

function getCsrfCookieOptions() {
  const refreshOptions = getRefreshCookieOptions();
  return {
    httpOnly: false,
    secure: refreshOptions.secure,
    sameSite: refreshOptions.sameSite,
    path: refreshOptions.path,
    maxAge: refreshOptions.maxAge
  };
}

function clearRefreshCookie(res) {
  const options = getRefreshCookieOptions();
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure: options.secure,
    sameSite: options.sameSite,
    path: options.path
  });
}

function clearCsrfCookie(res) {
  const options = getCsrfCookieOptions();
  res.clearCookie(CSRF_COOKIE_NAME, {
    httpOnly: false,
    secure: options.secure,
    sameSite: options.sameSite,
    path: options.path
  });
}

function setCsrfCookie(res) {
  const token = randomBytes(24).toString("hex");
  res.cookie(CSRF_COOKIE_NAME, token, getCsrfCookieOptions());
  return token;
}

app.get("/api/auth/csrf", (req, res) => {
  res.setHeader("Cache-Control", "no-store, private");
  const token = cleanText(req.cookies?.[CSRF_COOKIE_NAME], 120) || setCsrfCookie(res);
  return res.json({ csrf_token: token });
});

function getRequestIp(req) {
  return cleanText(req.ip || req.connection?.remoteAddress || "unknown", 80) || "unknown";
}

function requireCsrfToken(req, res) {
  const csrfCookie = cleanText(req.cookies?.[CSRF_COOKIE_NAME], 120);
  const csrfHeader = cleanText(req.headers["x-csrf-token"], 120);
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    res.status(403).json({ error: "Token CSRF invalido" });
    return false;
  }
  return true;
}

function issueAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

function createRefreshTokenSession(req, userId) {
  const token = randomBytes(48).toString("hex");
  const tokenHash = hashRefreshToken(token);
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const ip = cleanText(req.ip || req.connection?.remoteAddress || "unknown", 80);
  const userAgent = cleanText(req.headers["user-agent"] || "", 255);
  run(
    `INSERT INTO refresh_tokens
    (id, user_id, token_hash, expires_at, created_ip, user_agent)
    VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, userId, tokenHash, expiresAt, ip, userAgent]
  );
  return { token, sessionId, expiresAt };
}
function revokeRefreshTokenByHash(tokenHash, replacedByTokenId = null) {
  if (!tokenHash) return;
  run(
    "UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP, replaced_by_token_id = ? WHERE token_hash = ? AND revoked_at IS NULL",
    [replacedByTokenId, tokenHash]
  );
}

const loginAttempts = new Map();

function getLoginAttemptKey(req, emailNorm) {
  const ip = String(req.ip || req.connection?.remoteAddress || "unknown");
  return `${emailNorm}::${ip}`;
}

function getLoginAttemptState(key) {
  const current = loginAttempts.get(key);
  if (!current) return null;
  if (current.lockUntil && Date.now() > current.lockUntil) {
    loginAttempts.delete(key);
    return null;
  }
  return current;
}

function registerLoginFailure(key) {
  const current = getLoginAttemptState(key) || { attempts: 0, lockUntil: null };
  const attempts = current.attempts + 1;
  const lockUntil = attempts >= LOGIN_MAX_ATTEMPTS ? Date.now() + LOGIN_LOCK_MS : current.lockUntil;
  loginAttempts.set(key, { attempts, lockUntil });
  return { attempts, lockUntil };
}

function clearLoginFailures(key) {
  loginAttempts.delete(key);
}

function logLoginAudit(req, { userId = null, email = "", success = false, reason = "", attempts = null, lockUntil = null }) {
  try {
    const ip = getRequestIp(req);
    const userAgent = cleanText(req.headers["user-agent"] || "", 255);
    run(
      `INSERT INTO auth_login_audit
      (id, user_id, email, ip, user_agent, success, reason, attempts, lock_until, request_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        userId,
        cleanText(email, 180) || "unknown",
        ip,
        userAgent,
        success ? 1 : 0,
        cleanText(reason, 120),
        attempts,
        lockUntil ? new Date(lockUntil).toISOString() : null,
        req.requestId || null
      ]
    );
  } catch (err) {
    console.error("LOGIN AUDIT ERR:", req.requestId, err.message);
  }
}

function normalizeHeader(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseCsvLine(line, delimiter = ",") {
  const out = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out.map((v) => String(v || "").trim());
}

function parseCsvText(csvText, maxRows = IMPORT_MAX_ROWS) {
  const lines = String(csvText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  if (lines.length - 1 > maxRows) throw new Error("IMPORT_ROW_LIMIT");
  const headerLine = lines[0];
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ";" : ",";
  const headers = parseCsvLine(headerLine, delimiter).map(normalizeHeader);
  if (headers.length > IMPORT_MAX_COLUMNS) throw new Error("IMPORT_COLUMN_LIMIT");
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i], delimiter);
    const row = Object.create(null);
    headers.forEach((header, idx) => {
      row[header] = cols[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function parseSpreadsheetFile(filePath) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./import-spreadsheet-worker.js", import.meta.url), {
      workerData: { filePath, maxRows: IMPORT_MAX_ROWS, maxColumns: IMPORT_MAX_COLUMNS },
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 32 }
    });
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("IMPORT_PARSE_TIMEOUT"));
    }, 8000);
    worker.once("message", (result) => {
      clearTimeout(timeout);
      if (result?.error) return reject(new Error(result.error));
      const rows = Array.isArray(result?.rows) ? result.rows : [];
      resolve(rows.map((row) => {
        const normalized = Object.create(null);
        Object.keys(row || {}).forEach((key) => {
          normalized[normalizeHeader(key)] = String(row[key] ?? "").trim();
        });
        return normalized;
      }));
    });
    worker.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    worker.once("exit", (code) => {
      clearTimeout(timeout);
      if (code !== 0) reject(new Error("IMPORT_WORKER_FAILED"));
    });
  });
}

async function parseImportFileRows(file) {
  const ext = path.extname(String(file?.originalname || file?.path || "")).toLowerCase();
  if (ext === ".xlsx") {
    return parseSpreadsheetFile(file.path);
  }
  if (ext !== ".csv") throw new Error("IMPORT_FILE_INVALID");
  const csvText = fs.readFileSync(file.path, "utf8");
  return parseCsvText(csvText, IMPORT_MAX_ROWS);
}

function randomCaseSuffix(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[randomInt(chars.length)];
  }
  return out;
}

function generatePublicCaseCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = `RFA-${randomCaseSuffix(6)}`;
    const exists = get("SELECT id FROM cases WHERE case_code = ? LIMIT 1", [code]);
    if (!exists) return code;
  }
  return `RFA-${Date.now().toString(36).toUpperCase()}`;
}

let publicIntakeUserIdCache = null;
const PUBLIC_INTAKE_EMAIL = "intake.publico@rfargentina.com";

function getOrCreatePublicIntakeUserId() {
  if (publicIntakeUserIdCache) return publicIntakeUserIdCache;
  const existing = get("SELECT id FROM users WHERE email = ?", [PUBLIC_INTAKE_EMAIL]);
  if (existing && existing.id) {
    publicIntakeUserIdCache = existing.id;
    return existing.id;
  }

  const userId = randomUUID();
  const tempPasswordHash = bcrypt.hashSync(randomUUID(), 10);
  run(
    "INSERT INTO users (id, email, password_hash, role, email_verified, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
    [userId, PUBLIC_INTAKE_EMAIL, tempPasswordHash, "user", 1]
  );
  const created = get("SELECT id FROM users WHERE email = ?", [PUBLIC_INTAKE_EMAIL]);
  if (!created?.id) {
    throw new Error("No se pudo crear el usuario tecnico de carga publica");
  }
  publicIntakeUserIdCache = created.id;
  return created.id;
}


function ensureAdminAccounts() {
  if (!ADMIN_EMAILS.length) return;

  const password = cleanText(ADMIN_BOOTSTRAP_PASSWORD, 120) || null;
  if (password && !isStrongPassword(password)) {
    throw new Error("ADMIN_BOOTSTRAP_PASSWORD invalida: debe tener 8-72 caracteres, letras y numeros");
  }

  const passwordHash = password ? bcrypt.hashSync(password, 10) : null;

  ADMIN_EMAILS.forEach((email) => {
    const existing = get("SELECT id, role FROM users WHERE email = ?", [email]);
    if (existing?.id) {
      if (existing.role !== "admin" && passwordHash) {
        run(
          "UPDATE users SET role = 'admin', password_hash = ?, email_verified = 1 WHERE id = ?",
          [passwordHash, existing.id]
        );
      } else if (existing.role !== "admin") {
        run("UPDATE users SET role = 'admin', email_verified = 1 WHERE id = ?", [existing.id]);
      } else {
        run("UPDATE users SET email_verified = 1 WHERE id = ?", [existing.id]);
      }
      return;
    }

    if (!passwordHash) {
      console.warn(`ADMIN BOOTSTRAP WARN: no se crea ${email} porque falta ADMIN_BOOTSTRAP_PASSWORD`);
      return;
    }

    const userId = randomUUID();
    run(
      "INSERT INTO users (id, email, password_hash, role, email_verified, created_at) VALUES (?, ?, ?, 'admin', 1, CURRENT_TIMESTAMP)",
      [userId, email, passwordHash]
    );
  });
}

function canAccessCase(user, caso) {
  if (!user || !caso) return false;
  if (user.role === "admin") return true;
  if (user.role === "enterprise") return caso.enterprise_user_id === user.sub;
  return caso.user_id === user.sub;
}

function logSecurityEvent(req, {
  userId = null,
  eventType = "",
  resourceType = null,
  resourceId = null,
  success = true,
  details = null
}) {
  try {
    const ip = getRequestIp(req);
    const userAgent = cleanText(req.headers["user-agent"] || "", 255);
    const detailsText = details == null
      ? null
      : cleanText(typeof details === "string" ? details : JSON.stringify(details), 2000);
    run(
      `INSERT INTO security_events
      (id, user_id, event_type, resource_type, resource_id, success, details, ip, user_agent, request_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        userId,
        cleanText(eventType, 80) || "unknown_event",
        cleanText(resourceType, 80),
        cleanText(resourceId, 120),
        success ? 1 : 0,
        detailsText,
        ip,
        userAgent,
        req.requestId || null
      ]
    );
  } catch (err) {
    console.error("SECURITY EVENT ERR:", req.requestId, err.message);
  }
}
function signToken(user) {
  return issueAccessToken(user);
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No autorizado" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: "Token invalido" });
  }
}
function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Acceso restringido" });
  return next();
}

app.get("/", (_req, res) => {
  res.send("Servidor funcionando correctamente");
});

app.get("/health", (_req, res) => {
  res.status(200).send("OK");
});

// ---- Noticias RSS (cache 30 min) ----
const FEEDS = [
  "https://news.google.com/rss/search?q=site:ambito.com+OR+site:iprofesional.com+reclamos+financieros&hl=es-419&gl=AR&ceid=AR:es-419",
  "https://news.google.com/rss/search?q=billeteras+digitales+reclamos&hl=es-419&gl=AR&ceid=AR:es-419",
  "https://news.google.com/rss/search?q=BCRA+regulaci%C3%B3n+transferencias&hl=es-419&gl=AR&ceid=AR:es-419"
];

let cache = { data: [], ts: 0 };
const TTL_MS = 1000 * 60 * 30;

async function fetchFeed(url) {
  const { data: xml } = await axios.get(url, { timeout: 7000 });
  const json = await parseStringPromise(xml, { trim: true, explicitArray: false });
  const items = json.rss?.channel?.item || [];
  const arr = Array.isArray(items) ? items : [items];
  return arr.map((it) => ({ title: it.title, link: it.link, date: it.pubDate }));
}

const handleNoticias = async (_req, res) => {
  try {
    if (Date.now() - cache.ts < TTL_MS && cache.data.length) {
      return res.json(cache.data.slice(0, 8));
    }
    const settled = await Promise.allSettled(FEEDS.map(fetchFeed));
    const results = settled
      .filter((result) => result.status === "fulfilled")
      .flatMap((result) => result.value);
    const seen = new Set();
    const uniq = [];
    results
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .forEach((it) => {
        if (it?.link && !seen.has(it.link)) {
          seen.add(it.link);
          uniq.push(it);
        }
      });
    cache = { data: uniq, ts: Date.now() };
    res.json(uniq.slice(0, 8));
  } catch (e) {
    console.error("NEWS ERR:", e.message);
    res.status(500).json([]);
  }
};

app.get("/api/noticias", handleNoticias);
app.get("/api/news", handleNoticias);

// -------------------- EMPRESAS --------------------
app.post("/api/enterprise", enterpriseInquiryLimiter, async (req, res) => {
  try {
    const validated = validateBody(enterpriseInquirySchema, req.body);
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error });
    }
    const {
      empresa,
      rubro,
      contacto,
      email,
      telefono,
      servicios,
      descripcion,
      volumen,
      comentarios,
      acepta_privacidad
    } = validated.data;

    if (!isAccepted(acepta_privacidad)) {
      return res.status(400).json({ error: "Debes aceptar la Política de Privacidad" });
    }

    const inquiryId = randomUUID();
    const empresaClean = cleanText(empresa, 120);
    const rubroClean = cleanText(rubro, 120);
    const contactoClean = cleanText(contacto, 120);
    const emailClean = cleanText(email, 180)?.toLowerCase();
    const telefonoClean = cleanText(telefono, 60);
    const descripcionClean = cleanText(descripcion, 4000);
    const volumenClean = cleanText(volumen, 60);
    const comentariosClean = cleanText(comentarios, 2000);
    run(
      `INSERT INTO enterprise_inquiries (
        id, empresa, rubro, contacto, email, telefono, servicios, descripcion, volumen, comentarios,
        privacy_accepted, consent_version, consent_accepted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        inquiryId,
        empresaClean,
        rubroClean,
        contactoClean,
        emailClean,
        telefonoClean,
        typeof servicios === "string" ? servicios : JSON.stringify(servicios || []),
        descripcionClean,
        volumenClean,
        comentariosClean,
        1,
        POLICY_CONSENT_VERSION,
        new Date().toISOString()
      ]
    );
    const created = get("SELECT * FROM enterprise_inquiries WHERE id = ?", [inquiryId]);
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ error: "Error al registrar consulta" });
  }
});

app.post("/api/public/cases", publicCaseLimiter, publicCaseUpload, async (req, res) => {
  const uploadedFiles = req.files || [];
  let caseCreated = false;
  try {
    const validated = validateBody(publicCaseCreateSchema, req.body);
    if (!validated.ok) {
      uploadedFiles.forEach(deleteUploadedFile);
      return res.status(400).json({ error: validated.error });
    }

    const body = validated.data;
    const {
      categoria,
      nombre_completo,
      dni_cuit,
      email_contacto,
      telefono,
      entidad,
      tipo_entidad,
      monto_valor,
      monto_escala,
      monto_moneda,
      medios_pago,
      relato,
      autorizacion,
      acepta_terminos,
      acepta_privacidad,
      detalle
    } = body;

    const detalleValue = cleanText(relato || detalle, 4000);
    if (!detalleValue) {
      uploadedFiles.forEach(deleteUploadedFile);
      return res.status(400).json({ error: "La descripcion del caso es obligatoria" });
    }

    const emailContactoClean = cleanText(email_contacto === "" ? null : email_contacto, 180)?.toLowerCase();
    const dniCuitClean = cleanText(dni_cuit, 40);
    if (!emailContactoClean) {
      uploadedFiles.forEach(deleteUploadedFile);
      return res.status(400).json({ error: "Debes indicar un correo electrónico válido" });
    }

    const files = uploadedFiles.map((file) => ({
      originalName: file.originalname,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype
    }));

    const caseId = randomUUID();
    const caseCode = generatePublicCaseCode();
    const estadoInicial = "received";
    const intakeUserId = getOrCreatePublicIntakeUserId();

    const insertValues = [
      caseId,
      intakeUserId,
      cleanText(categoria, 120),
      detalleValue,
      estadoInicial,
      cleanText(nombre_completo, 120),
      dniCuitClean,
      emailContactoClean,
      cleanText(telefono, 60),
      cleanText(entidad, 160),
      cleanText(tipo_entidad, 160),
      cleanText(monto_valor, 40),
      cleanText(monto_escala, 40),
      cleanText(monto_moneda, 20),
      typeof medios_pago === "string" ? medios_pago : JSON.stringify(medios_pago || []),
      cleanText(relato, 4000),
      autorizacion === "true" || autorizacion === true ? 1 : 0,
      isAccepted(acepta_terminos) ? 1 : 0,
      isAccepted(acepta_privacidad) ? 1 : 0,
      POLICY_CONSENT_VERSION,
      new Date().toISOString(),
      files.length ? JSON.stringify(files) : null,
      INITIAL_ANALYSIS_SERVICE_CODE,
      INITIAL_ANALYSIS_SERVICE_CODE,
      "analysis",
      "ARS",
      caseCode,
      "Pendiente",
      "Pendiente",
      2
    ].map((value) => (value === undefined ? null : value));

    run(
      `INSERT INTO cases (
        id, user_id, categoria, detalle, estado, nombre_completo, dni_cuit, email_contacto, telefono,
        entidad, tipo_entidad, monto_valor, monto_escala, monto_moneda, medios_pago, relato,
        autorizacion, terms_accepted, privacy_accepted, consent_version, consent_accepted_at,
        adjuntos, plan_elegido, service_code, commercial_status, quoted_currency, case_code, prioridad, riesgo,
        commercial_flow_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      insertValues
    );
    caseCreated = true;

    run("INSERT INTO case_updates (id, case_id, author_id, mensaje, estado, prioridad, visibility) VALUES (?, ?, ?, ?, ?, ?, ?)", [
      randomUUID(),
      caseId,
      intakeUserId,
      "Caso cargado por formulario publico.",
      estadoInicial,
      null,
      "public"
    ]);

    return res.status(201).json({
      id: caseId,
      case_code: caseCode,
      estado: estadoInicial,
      message: "Caso cargado correctamente. Guarda tu ID para seguimiento."
    });
  } catch (err) {
    if (!caseCreated) uploadedFiles.forEach(deleteUploadedFile);
    console.error("PUBLIC CASE CREATE ERR:", req.requestId, err?.message || err);
    return res.status(500).json({ error: "Error al crear el caso" });
  }
});

app.post("/api/public/case-lookup", lookupLimiter, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("Pragma", "no-cache");
  try {
    const validated = validateBody(publicCaseLookupSchema, req.body);
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error });
    }

    const caseId = String(validated.data.case_id || "").trim();
    const identifier = String(validated.data.identifier || "").trim();
    if (!caseId || !identifier) {
      return res.status(400).json({ error: "Debes ingresar ID de caso e identificador" });
    }

    const notFoundMessage = "No se encontro un caso con esos datos";
    const caso = findPublicCaseByLookup(caseId, identifier);
    if (!caso) {
      return res.status(404).json({ error: notFoundMessage });
    }

    const updates = all(
      `
      SELECT cu.id, cu.mensaje, cu.estado, cu.prioridad, cu.created_at
      FROM case_updates cu
      WHERE cu.case_id = ?
        AND (
          cu.visibility = 'public'
          OR (cu.visibility IS NULL AND COALESCE(?, 1) < 2)
        )
      ORDER BY cu.created_at DESC, cu.rowid DESC
      `,
      [caso.id, Number(caso.commercial_flow_version) || 1]
    );

    const proposalVisible = hasVisibleProposal(caso);
    const commercialStatus = getEffectiveCommercialStatus(caso);
    const paymentReceiptPending = getCasePaymentReceipts(caso.id).some((receipt) => receipt.status === "pending");
    const operationalStage = getPersonaV2OperationalStage({
      ...caso,
      commercial_status: commercialStatus,
      payment_receipt_pending: paymentReceiptPending,
      operational_status_for_stage: updates.find((update) => update.estado)?.estado || "received"
    });
    const acceptedSnapshot = ["accepted", "payment_pending", "paid"].includes(commercialStatus)
      ? parseAcceptedProposalSnapshot(caso.accepted_proposal_snapshot)
      : null;
    const proposalView = acceptedSnapshot || {
      service_code: getStoredServiceCode(caso),
      amount: Number(caso.quoted_amount) || null,
      currency: caso.quoted_currency || "ARS",
      scope: caso.quoted_scope || null,
      communication_mode: caso.customer_communication_mode || caso.communication_mode || null
    };
    const serviceOffers = Number(caso.commercial_flow_version) >= 2 && !acceptedSnapshot
      ? getCaseServiceOffers(caso.id, { publishedOnly: true })
      : [];
    const conversation = getConversationForCase(caso.id);
    const emailMatchesExactly = hasExactPublicEmailMatch(caso, identifier);
    const publicConversation = { enabled: Boolean(conversation?.enabled && emailMatchesExactly) };
    if (publicConversation.enabled) {
      const access = createConversationAccessToken();
      const now = new Date().toISOString();
      run("DELETE FROM case_conversation_access_tokens WHERE julianday(expires_at) <= julianday('now')");
      run(
        `INSERT INTO case_conversation_access_tokens (token_hash, conversation_id, expires_at, created_at)
         VALUES (?, ?, ?, ?)`,
        [access.tokenHash, conversation.id, access.expiresAt, now]
      );
      publicConversation.access_token = access.token;
      publicConversation.expires_at = access.expiresAt;
    }

    const isPersonaV2 = Number(caso.commercial_flow_version) >= 2;
    const publicUpdates = isPersonaV2
      ? updates.map(({ id, mensaje, created_at }) => ({ id, mensaje, created_at }))
      : updates;
    return res.json({
      case: {
        id: caso.id,
        case_code: caso.case_code || caso.id,
        ...(!isPersonaV2 ? { estado: caso.estado || "received" } : {}),
        ...(operationalStage ? { operational_stage: operationalStage } : {}),
        categoria: caso.categoria || null,
        entidad: caso.entidad || null,
        service_code: proposalVisible ? proposalView.service_code : INITIAL_ANALYSIS_SERVICE_CODE,
        commercial_status: commercialStatus,
        commercial_flow_version: Number(caso.commercial_flow_version) || 1,
        payment_receipt_pending: paymentReceiptPending,
        proposal: proposalVisible && (Number(caso.commercial_flow_version) < 2 || acceptedSnapshot)
          ? {
              ...proposalView,
              status: commercialStatus,
              quoted_at: caso.quoted_at || null,
              accepted_at: caso.proposal_accepted_at || null,
              payment_confirmed_at: caso.payment_confirmed_at || null
            }
          : null,
        payment_receipt_uploaded_at: caso.payment_receipt_uploaded_at || null,
        has_payment_receipt: Boolean(caso.payment_receipt_filename),
        email_contacto: caso.email_contacto || null,
        created_at: caso.created_at,
        updated_at: caso.updated_at
      },
      service_offers: serviceOffers,
      updates: publicUpdates,
      conversation: publicConversation
    });
  } catch (err) {
    console.error("PUBLIC CASE LOOKUP ERR:", req.requestId, err.message);
    return res.status(500).json({ error: "Error al consultar el caso" });
  }
});

app.get("/api/public/case-conversations", conversationNoStore, conversationReadLimiter, conversationTokenRequired, (req, res) => {
  return res.json(getPublicConversationPayload(getConversationForCase(req.conversation.case_id)));
});

app.post(
  "/api/public/case-conversations/messages",
  conversationNoStore,
  conversationWriteLimiter,
  conversationTokenRequired,
  conversationUpload,
  (req, res) => {
    const uploadedFiles = req.files || [];
    const validated = validateBody(conversationMessageSchema, req.body);
    if (!validated.ok) {
      uploadedFiles.forEach(deleteUploadedFile);
      return res.status(400).json({ error: validated.error });
    }
    if (!validated.data.body && uploadedFiles.length === 0) {
      return res.status(400).json({ error: "Escribí la respuesta o adjuntá al menos un archivo." });
    }
    const conversation = getConversationForCase(req.conversation.case_id);
    if (!conversation?.enabled) {
      uploadedFiles.forEach(deleteUploadedFile);
      return res.status(404).json({ error: "Conversación no disponible" });
    }

    let messageId;
    try {
      messageId = runInTransaction(() => {
        if (!runAndCount(
          "UPDATE case_conversations SET client_reply_enabled = 0 WHERE id = ? AND enabled = 1 AND client_reply_enabled = 1",
          [conversation.id]
        )) {
          const error = new Error("El turno de respuesta no está habilitado.");
          error.code = "CLIENT_REPLY_TURN_UNAVAILABLE";
          throw error;
        }
        const now = new Date().toISOString();
        const inserted = get(
          `INSERT INTO case_conversation_messages
           (conversation_id, sender_type, message_type, body, channel, author_user_id, created_at)
           VALUES (?, 'client', 'received_reply', ?, NULL, NULL, ?)
           RETURNING id`,
          [conversation.id, validated.data.body, now]
        );
        const id = Number(inserted?.id);
        persistConversationAttachments(id, uploadedFiles, now);
        run(
          "UPDATE case_conversations SET pending_admin_attention = 1, updated_at = ? WHERE id = ?",
          [now, conversation.id]
        );
        run("UPDATE cases SET updated_at = ? WHERE id = ?", [now, conversation.case_id]);
        return id;
      });
    } catch (error) {
      uploadedFiles.forEach(deleteUploadedFile);
      if (error.code === "CLIENT_REPLY_TURN_UNAVAILABLE") {
        return res.status(409).json({ error: "No hay una respuesta habilitada para este caso." });
      }
      return res.status(500).json({ error: "No se pudo enviar la respuesta" });
    }
    return res.status(201).json({
      message_id: messageId,
      ...getPublicConversationPayload(getConversationForCase(conversation.case_id))
    });
  }
);

app.get(
  "/api/public/case-conversations/attachments/:attachmentId",
  conversationNoStore,
  conversationReadLimiter,
  conversationTokenRequired,
  (req, res) => {
    const attachment = get(
      `SELECT a.storage_filename, a.original_name
       FROM case_conversation_attachments a
       JOIN case_conversation_messages m ON m.id = a.message_id
       JOIN case_conversations cc ON cc.id = m.conversation_id
       WHERE a.id = ? AND cc.id = ? AND cc.enabled = 1`,
      [req.params.attachmentId, req.conversation.id]
    );
    if (!attachment) return res.status(404).json({ error: "Adjunto no disponible" });
    const filename = path.basename(String(attachment.storage_filename || ""));
    const filePath = path.join(UPLOADS_DIR, filename);
    if (!filename || !fs.existsSync(filePath)) return res.status(404).json({ error: "Adjunto no disponible" });
    return res.download(filePath, cleanText(attachment.original_name, 255) || "adjunto");
  }
);

app.get(
  "/api/cases/:id/conversations",
  conversationNoStore,
  authRequired,
  adminOnly,
  conversationReadLimiter,
  individualAdminConversationCase,
  (req, res) => res.json(getConversationPayload(getConversationForCase(req.conversationCase.id)))
);

app.patch(
  "/api/cases/:id/conversations",
  conversationNoStore,
  authRequired,
  adminOnly,
  conversationAdminWriteLimiter,
  individualAdminConversationCase,
  (req, res) => {
    const validated = validateBody(conversationSettingsSchema, req.body);
    if (!validated.ok) return res.status(400).json({ error: "Configuración inválida" });
    const now = new Date().toISOString();
    let conversation = getConversationForCase(req.conversationCase.id);
    if (validated.data.enabled === true) {
      run(
        `INSERT INTO case_conversations (id, case_id, enabled, created_at, updated_at)
         VALUES (?, ?, 1, ?, ?)
         ON CONFLICT(case_id) DO UPDATE SET enabled = 1, updated_at = excluded.updated_at`,
        [randomUUID(), req.conversationCase.id, now, now]
      );
    } else if (validated.data.enabled === false && conversation) {
      runInTransaction(() => {
        run("UPDATE case_conversations SET enabled = 0, client_reply_enabled = 0, updated_at = ? WHERE id = ?", [now, conversation.id]);
        run("DELETE FROM case_conversation_access_tokens WHERE conversation_id = ?", [conversation.id]);
      });
    }
    conversation = getConversationForCase(req.conversationCase.id);
    if (validated.data.client_reply_enabled !== undefined) {
      if (!conversation?.enabled) return res.status(409).json({ error: "Habilitá Conversaciones antes de habilitar respuestas." });
      run("UPDATE case_conversations SET client_reply_enabled = ?, updated_at = ? WHERE id = ?", [validated.data.client_reply_enabled ? 1 : 0, now, conversation.id]);
      conversation = getConversationForCase(req.conversationCase.id);
    }
    return res.json(getConversationPayload(conversation));
  }
);

app.post(
  "/api/cases/:id/conversations/messages",
  conversationNoStore,
  authRequired,
  adminOnly,
  conversationAdminWriteLimiter,
  individualAdminConversationCase,
  conversationUpload,
  (req, res) => {
    const uploadedFiles = req.files || [];
    const validated = validateBody(conversationMessageSchema, req.body);
    if (!validated.ok) {
      uploadedFiles.forEach(deleteUploadedFile);
      return res.status(400).json({ error: validated.error });
    }
    if (!validated.data.body) {
      uploadedFiles.forEach(deleteUploadedFile);
      return res.status(400).json({ error: "El mensaje de RFA no puede estar vacío." });
    }
    const conversation = getConversationForCase(req.conversationCase.id);
    if (!conversation?.enabled) {
      uploadedFiles.forEach(deleteUploadedFile);
      return res.status(409).json({ error: "Habilitá Conversaciones para publicar un mensaje" });
    }

    let messageId;
    try {
      messageId = runInTransaction(() => {
        const now = new Date().toISOString();
        const inserted = get(
          `INSERT INTO case_conversation_messages
           (conversation_id, sender_type, message_type, body, channel, author_user_id, created_at)
           VALUES (?, 'rfa', 'prepared_message', ?, ?, ?, ?)
           RETURNING id`,
          [conversation.id, validated.data.body, cleanText(validated.data.channel, 160), req.user.sub, now]
        );
        const id = Number(inserted?.id);
        persistConversationAttachments(id, uploadedFiles, now);
        run("UPDATE case_conversations SET updated_at = ? WHERE id = ?", [now, conversation.id]);
        run("UPDATE cases SET updated_at = ? WHERE id = ?", [now, conversation.case_id]);
        return id;
      });
    } catch (_error) {
      uploadedFiles.forEach(deleteUploadedFile);
      return res.status(500).json({ error: "No se pudo publicar el mensaje" });
    }
    return res.status(201).json({
      message_id: messageId,
      ...getConversationPayload(getConversationForCase(req.conversationCase.id))
    });
  }
);

app.post(
  "/api/cases/:id/conversations/mark-attended",
  conversationNoStore,
  authRequired,
  adminOnly,
  conversationAdminWriteLimiter,
  individualAdminConversationCase,
  (req, res) => {
    const conversation = getConversationForCase(req.conversationCase.id);
    if (!conversation) return res.status(404).json({ error: "Conversación no disponible" });
    run(
      "UPDATE case_conversations SET pending_admin_attention = 0, updated_at = ? WHERE id = ?",
      [new Date().toISOString(), conversation.id]
    );
    return res.json(getConversationPayload(getConversationForCase(req.conversationCase.id)));
  }
);

app.get(
  "/api/cases/:id/conversations/attachments/:attachmentId",
  conversationNoStore,
  authRequired,
  adminOnly,
  conversationReadLimiter,
  individualAdminConversationCase,
  (req, res) => {
    const attachment = get(
      `SELECT a.storage_filename, a.original_name
       FROM case_conversation_attachments a
       JOIN case_conversation_messages m ON m.id = a.message_id
       JOIN case_conversations cc ON cc.id = m.conversation_id
       WHERE a.id = ? AND cc.case_id = ?`,
      [req.params.attachmentId, req.conversationCase.id]
    );
    if (!attachment) return res.status(404).json({ error: "Adjunto no disponible" });
    const filename = path.basename(String(attachment.storage_filename || ""));
    const filePath = path.join(UPLOADS_DIR, filename);
    if (!filename || !fs.existsSync(filePath)) return res.status(404).json({ error: "Adjunto no disponible" });
    return res.download(filePath, cleanText(attachment.original_name, 255) || "adjunto");
  }
);

app.get(
  "/api/admin/conversations/pending",
  authRequired,
  adminOnly,
  conversationReadLimiter,
  conversationNoStore,
  (_req, res) => res.json(all(
    `SELECT case_id FROM case_conversations
     WHERE pending_admin_attention = 1`
  ).map((row) => row.case_id))
);

app.post("/api/admin/cases/:id/public-action-token", authRequired, adminOnly, adminActionTokenLimiter, async (req, res) => {
  try {
    const validated = validateBody(publicActionTokenIssueSchema, req.body);
    if (!validated.ok) return res.status(400).json({ error: "Solicitud invalida" });
    const { action } = validated.data;
    const caso = get("SELECT id, case_code, enterprise_user_id FROM cases WHERE id = ?", [req.params.id]);
    if (!caso || caso.enterprise_user_id) return res.status(404).json({ error: "No se pudo generar la autorizacion" });

    const current = get("SELECT * FROM cases WHERE id = ?", [caso.id]);
    const expectedStatus = action === "proposal_accept" ? "proposal_sent" : "payment_pending";
    if (getEffectiveCommercialStatus(current) !== expectedStatus) {
      return res.status(409).json({ error: "La accion no esta disponible para este caso" });
    }

    const rawToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + PUBLIC_ACTION_TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();
    const tokenId = randomUUID();
    const actionName = action === "proposal_accept" ? "proposal_accept" : "payment_receipt";
    const actionUrl = new URL("/consultar-caso", APP_BASE_URL);
    actionUrl.hash = new URLSearchParams({
      rfa_action: actionName,
      rfa_token: rawToken,
      rfa_case: caso.case_code || caso.id
    }).toString();

    runInTransaction(() => {
      run("UPDATE public_case_action_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE case_id = ? AND action = ? AND used_at IS NULL AND revoked_at IS NULL", [caso.id, actionName]);
      run(
        `INSERT INTO public_case_action_tokens (id, case_id, action, token_hash, expires_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [tokenId, caso.id, actionName, hashPublicActionToken(rawToken), expiresAt, req.user.sub]
      );
    });
    logSecurityEvent(req, { eventType: "public_case_action_token_issued", resourceType: "case", resourceId: caso.id, success: true, details: actionName });
    return res.status(201).json({ action: actionName, url: actionUrl.toString(), expires_at: expiresAt });
  } catch (err) {
    console.error("PUBLIC ACTION TOKEN ISSUE ERR:", req.requestId, err.message);
    return res.status(500).json({ error: "No se pudo generar la autorizacion" });
  }
});

app.get("/api/cases/:id/service-offers", authRequired, adminOnly, (req, res) => {
  const caso = get("SELECT id, enterprise_user_id FROM cases WHERE id = ?", [req.params.id]);
  if (!caso || caso.enterprise_user_id) return res.status(404).json({ error: "Caso no encontrado" });
  return res.json(getCaseServiceOffers(caso.id));
});

app.put("/api/cases/:id/service-offers", authRequired, adminOnly, adminActionTokenLimiter, (req, res) => {
  try {
    const caso = get("SELECT * FROM cases WHERE id = ?", [req.params.id]);
    if (!caso || caso.enterprise_user_id) return res.status(404).json({ error: "Caso no encontrado" });
    if (Number(caso.commercial_flow_version) < 2) return res.status(409).json({ error: "Este caso conserva el flujo comercial histórico" });
    if (caso.proposal_accepted_at || ["accepted", "payment_pending", "paid"].includes(getEffectiveCommercialStatus(caso))) {
      return res.status(409).json({ error: "Las opciones no pueden modificarse después de la aceptación" });
    }
    const validated = validateBody(serviceOfferPublicationSchema, req.body);
    if (!validated.ok) return res.status(400).json({ error: validated.error });
    const offers = validated.data.offers;
    if (new Set(offers.map((offer) => offer.service_code)).size !== offers.length) {
      return res.status(400).json({ error: "Cada servicio puede ofrecerse una sola vez" });
    }
    const normalizedOffers = [];
    for (const offer of offers) {
      const amount = normalizeQuotedAmount(offer.quoted_amount);
      const modes = [...new Set(offer.available_communication_modes || [])];
      if (amount.error || !amount.value) return res.status(400).json({ error: amount.error || "Indica un precio válido" });
      if (offer.service_code === "rfa-management" && modes.length === 0) {
        return res.status(400).json({ error: "Gestión RFA requiere al menos una modalidad de comunicaciones disponible" });
      }
      if (offer.service_code === "professional-folder" && modes.length > 0) {
        return res.status(400).json({ error: "Carpeta Profesional no admite modalidad de comunicaciones" });
      }
      normalizedOffers.push({ ...offer, quoted_amount: amount.value, available_communication_modes: modes });
    }

    const now = new Date().toISOString();
    const inserted = runInTransaction(() => {
      run("UPDATE case_service_offers SET status = 'withdrawn', withdrawn_at = ? WHERE case_id = ? AND status = 'published'", [now, caso.id]);
      const created = normalizedOffers.map((offer) => {
        const id = randomUUID();
        run(
          `INSERT INTO case_service_offers
           (id, case_id, service_code, quoted_amount, quoted_currency, quoted_scope, available_communication_modes, status, created_by, created_at, published_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?)`,
          [id, caso.id, offer.service_code, offer.quoted_amount, offer.quoted_currency, cleanText(offer.quoted_scope, 4000), JSON.stringify(offer.available_communication_modes), req.user.sub, now, now]
        );
        return { ...offer, id, case_id: caso.id, status: "published", created_at: now, published_at: now, withdrawn_at: null };
      });
      const first = created[0];
      run(
        `UPDATE cases SET commercial_status = 'proposal_sent', quoted_at = COALESCE(quoted_at, ?),
          service_code = ?, quoted_amount = ?, quoted_currency = ?, quoted_scope = ?, communication_mode = NULL,
          selected_offer_id = NULL, customer_communication_mode = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [now, first.service_code, first.quoted_amount, first.quoted_currency, first.quoted_scope, caso.id]
      );
      run("INSERT INTO case_updates (id, case_id, author_id, mensaje, estado, prioridad, visibility) VALUES (?, ?, ?, ?, ?, ?, ?)", [
        randomUUID(), caso.id, req.user.sub, "RFA publicó opciones de servicio para este caso.", null, null, "public"
      ]);
      return created;
    });
    return res.status(201).json({ offers: inserted, case: addPersonaV2OperationalStage(get("SELECT * FROM cases WHERE id = ?", [caso.id])) });
  } catch (err) {
    console.error("CASE SERVICE OFFER PUBLISH ERR:", req.requestId, err.message);
    return res.status(500).json({ error: "No se pudieron publicar las opciones" });
  }
});

app.post("/api/public/case-action-token", publicActionGrantLimiter, (req, res) => {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("Pragma", "no-cache");
  const validated = validateBody(publicCaseActionGrantSchema, req.body);
  if (!validated.ok) return res.status(403).json({ error: "No se pudo autorizar la accion" });

  const { case_id: caseId, identifier, action } = validated.data;
  const caso = findPublicCaseByLookup(caseId, identifier);
  const expectedStatus = action === "proposal_accept" ? "proposal_sent" : "payment_pending";
  const actionAvailable = caso && Number(caso.commercial_flow_version) >= 2 &&
    getEffectiveCommercialStatus(caso) === expectedStatus &&
    hasExactPublicEmailMatch(caso, identifier) &&
    (action !== "proposal_accept" || getCaseServiceOffers(caso.id, { publishedOnly: true }).length > 0);
  if (!actionAvailable) return res.status(403).json({ error: "No se pudo autorizar la accion" });

  try {
    const grant = issuePublicCaseActionToken(caso.id, action);
    return res.json({ action, token: grant.token, expires_at: grant.expires_at });
  } catch (err) {
    console.error("PUBLIC ACTION GRANT ERR:", req.requestId, err.message);
    return res.status(500).json({ error: "No se pudo autorizar la accion" });
  }
});

app.post("/api/public/case-proposal-accept", publicActionLimiter, async (req, res) => {
  try {
    const validated = validateBody(publicProposalAcceptSchema, req.body);
    if (!validated.ok) return res.status(403).json({ error: "No se pudo autorizar la accion" });

    const caso = findPublicCaseByLookup(validated.data.case_id, validated.data.identifier);
    const tokenRow = caso && hasExactPublicEmailMatch(caso, validated.data.identifier)
      ? getActivePublicActionToken(validated.data.action_token, caso.id, "proposal_accept")
      : null;
    if (!caso || !tokenRow) {
      return res.status(403).json({ error: "No se pudo autorizar la accion" });
    }
    if (validated.data.offer_id) {
      if (Number(caso.commercial_flow_version) < 2 || caso.commercial_status !== "proposal_sent") {
        return res.status(409).json({ error: "Las opciones no están disponibles para aceptar" });
      }
      const offer = get(
        `SELECT id, service_code, quoted_amount, quoted_currency, quoted_scope, available_communication_modes
         FROM case_service_offers WHERE id = ? AND case_id = ? AND status = 'published'`,
        [validated.data.offer_id, caso.id]
      );
      if (!offer) return res.status(403).json({ error: "No se pudo autorizar la accion" });
      let availableModes = [];
      try { availableModes = JSON.parse(offer.available_communication_modes || "[]"); } catch { availableModes = []; }
      const chosenMode = validated.data.communication_mode || null;
      if (offer.service_code === "rfa-management" && (!chosenMode || !availableModes.includes(chosenMode))) {
        return res.status(400).json({ error: "Selecciona una modalidad disponible para esta opción" });
      }
      if (offer.service_code === "professional-folder" && chosenMode) {
        return res.status(400).json({ error: "Esta opción no utiliza modalidad de comunicaciones" });
      }
      const acceptedAt = new Date().toISOString();
      const accepted = runInTransaction(() => {
        const active = getActivePublicActionToken(validated.data.action_token, caso.id, "proposal_accept");
        const currentOffer = get(
          `SELECT id, service_code, quoted_amount, quoted_currency, quoted_scope, available_communication_modes
           FROM case_service_offers WHERE id = ? AND case_id = ? AND status = 'published'`,
          [offer.id, caso.id]
        );
        if (!active || active.id !== tokenRow.id || caso.commercial_status !== "proposal_sent" || !currentOffer) return false;
        let currentModes = [];
        try { currentModes = JSON.parse(currentOffer.available_communication_modes || "[]"); } catch { currentModes = []; }
        if (currentOffer.service_code === "rfa-management" && !currentModes.includes(chosenMode)) return false;
        const snapshot = serializeAcceptedProposalSnapshot({
          offer_id: currentOffer.id,
          service_code: currentOffer.service_code,
          quoted_amount: Number(currentOffer.quoted_amount),
          quoted_currency: currentOffer.quoted_currency,
          quoted_scope: currentOffer.quoted_scope,
          communication_mode: chosenMode,
          accepted_at: acceptedAt
        });
        if (!runAndCount(
          `UPDATE cases SET commercial_status = 'payment_pending', proposal_accepted_at = ?,
            accepted_proposal_snapshot = ?, selected_offer_id = ?, customer_communication_mode = ?,
            service_code = ?, quoted_amount = ?, quoted_currency = ?, quoted_scope = ?, communication_mode = ?,
            updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND commercial_status = 'proposal_sent'`,
          [acceptedAt, snapshot, currentOffer.id, chosenMode, currentOffer.service_code, currentOffer.quoted_amount,
            currentOffer.quoted_currency, currentOffer.quoted_scope, chosenMode, caso.id]
        )) return false;
        if (!runAndCount(
          `UPDATE public_case_action_tokens SET used_at = CURRENT_TIMESTAMP
           WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ?`,
          [tokenRow.id, new Date().toISOString()]
        )) throw new Error("ACTION_TOKEN_CONSUME_FAILED");
        run("UPDATE case_service_offers SET status = CASE WHEN id = ? THEN 'published' ELSE 'withdrawn' END, withdrawn_at = CASE WHEN id = ? THEN withdrawn_at ELSE ? END WHERE case_id = ? AND status = 'published'", [currentOffer.id, currentOffer.id, acceptedAt, caso.id]);
        run("INSERT INTO case_updates (id, case_id, author_id, mensaje, estado, prioridad, visibility) VALUES (?, ?, ?, ?, ?, ?, ?)", [
          randomUUID(), caso.id, null, "El cliente eligió y aceptó una opción de servicio.", null, null, "public"
        ]);
        return true;
      });
      if (!accepted) return res.status(403).json({ error: "No se pudo autorizar la accion" });
      logSecurityEvent(req, { eventType: "case_service_offer_accepted", resourceType: "case", resourceId: caso.id, success: true });
      return res.json({ message: "Opción aceptada correctamente.", commercial_status: "payment_pending", accepted_at: acceptedAt });
    }
    if (caso.commercial_status !== "proposal_sent") {
      return res.status(409).json({ error: "La propuesta no esta disponible para aceptar" });
    }
    if (!PAID_SERVICE_CODES.has(String(caso.service_code || "")) || !Number(caso.quoted_amount) || !caso.quoted_scope) {
      return res.status(409).json({ error: "La propuesta esta incompleta" });
    }

    const accepted = runInTransaction(() => {
      const active = getActivePublicActionToken(validated.data.action_token, caso.id, "proposal_accept");
      if (!active || active.id !== tokenRow.id) return false;
      const currentProposal = get(
        `SELECT service_code, quoted_amount, quoted_currency, quoted_scope, communication_mode, commercial_status
         FROM cases WHERE id = ?`,
        [caso.id]
      );
      if (
        !currentProposal ||
        currentProposal.commercial_status !== "proposal_sent" ||
        !PAID_SERVICE_CODES.has(String(currentProposal.service_code || "")) ||
        !Number.isSafeInteger(Number(currentProposal.quoted_amount)) ||
        Number(currentProposal.quoted_amount) < 1 ||
        !currentProposal.quoted_scope ||
        !isValidCommunicationMode(currentProposal.communication_mode)
      ) return false;
      const acceptedAt = new Date().toISOString();
      const acceptedSnapshot = serializeAcceptedProposalSnapshot({ ...currentProposal, accepted_at: acceptedAt });
      if (!runAndCount(
        `UPDATE cases SET commercial_status = 'payment_pending', proposal_accepted_at = ?,
                          accepted_proposal_snapshot = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND commercial_status = 'proposal_sent'`, [acceptedAt, acceptedSnapshot, caso.id]
      )) return false;
      if (!runAndCount(
        `UPDATE public_case_action_tokens SET used_at = CURRENT_TIMESTAMP
         WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ?`,
        [tokenRow.id, new Date().toISOString()]
      )) throw new Error("ACTION_TOKEN_CONSUME_FAILED");
      run("INSERT INTO case_updates (id, case_id, author_id, mensaje, estado, prioridad, visibility) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [randomUUID(), caso.id, null, "Propuesta aceptada por el cliente.", null, null, "public"]);
      return true;
    });
    if (!accepted) return res.status(403).json({ error: "No se pudo autorizar la accion" });
    logSecurityEvent(req, {
      eventType: "case_proposal_accept",
      resourceType: "case",
      resourceId: caso.id,
      success: true
    });
    return res.json({
      message: "Propuesta aceptada correctamente.",
      commercial_status: "payment_pending",
      accepted_at: acceptedAt
    });
  } catch (err) {
    console.error("PUBLIC PROPOSAL ACCEPT ERR:", req.requestId, err.message);
    return res.status(500).json({ error: "No se pudo registrar la aceptacion" });
  }
});

app.post("/api/public/case-payment-receipt", publicReceiptLimiter, (req, res, next) => {
  upload.single("comprobante")(req, res, (err) => {
    if (err) return next(err);
    if (req.file && !validateUploadedFileContent(req.file)) {
      deleteUploadedFile(req.file);
      req.file = null;
      return res.status(400).json({ error: "El contenido del comprobante no coincide con su formato" });
    }
    return next();
  });
}, async (req, res) => {
  try {
    const validated = validateBody(publicPaymentReceiptSchema, req.body);
    if (!validated.ok) {
      deleteUploadedFile(req.file);
      return res.status(400).json({ error: "Solicitud invalida" });
    }
    const caseId = cleanText(validated.data.case_id, 80);
    const identifier = cleanText(validated.data.identifier, 180);
    if (!caseId || !identifier) {
      deleteUploadedFile(req.file);
      return res.status(400).json({ error: "Debes indicar ID de caso e identificador" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Debes adjuntar un comprobante" });
    }

    const caso = findPublicCaseByLookup(caseId, identifier);
    const tokenRow = caso && hasExactPublicEmailMatch(caso, identifier)
      ? getActivePublicActionToken(validated.data.action_token, caso.id, "payment_receipt")
      : null;
    if (!caso || !tokenRow) {
      deleteUploadedFile(req.file);
      return res.status(403).json({ error: "No se pudo autorizar la accion" });
    }
    if (getEffectiveCommercialStatus(caso) !== "payment_pending") {
      deleteUploadedFile(req.file);
      return res.status(409).json({ error: "El caso no se encuentra pendiente de pago" });
    }

    const receiptId = randomUUID();
    const saved = runInTransaction(() => {
      const active = getActivePublicActionToken(validated.data.action_token, caso.id, "payment_receipt");
      if (!active || active.id !== tokenRow.id) return false;
      if (!runAndCount(
        `UPDATE cases SET payment_receipt_filename = ?, payment_receipt_original_name = ?,
          payment_receipt_uploaded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND (
           commercial_status = 'payment_pending' OR
           (COALESCE(commercial_status, '') = '' AND lower(trim(estado)) = 'viable (pendiente de pago)'
             AND lower(trim(COALESCE(plan_elegido, ''))) NOT IN ('', 'analysis', 'analisis inicial'))
         )`,
        [req.file.filename, cleanText(req.file.originalname, 255), caso.id]
      )) return false;
      run("UPDATE case_payment_receipts SET status = 'superseded' WHERE case_id = ? AND status = 'pending'", [caso.id]);
      run(
        `INSERT INTO case_payment_receipts
         (id, case_id, storage_filename, original_filename, mime_type, size_bytes, uploaded_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [receiptId, caso.id, path.basename(req.file.filename), cleanText(path.basename(req.file.originalname), 255) || "comprobante", cleanText(req.file.mimetype, 120) || "application/octet-stream", Number(req.file.size) || 0, new Date().toISOString()]
      );
      if (!runAndCount(
        `UPDATE public_case_action_tokens SET used_at = CURRENT_TIMESTAMP
         WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ?`,
        [tokenRow.id, new Date().toISOString()]
      )) throw new Error("ACTION_TOKEN_CONSUME_FAILED");
      run("INSERT INTO case_updates (id, case_id, author_id, mensaje, estado, prioridad, visibility) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [randomUUID(), caso.id, null, "Cliente cargo comprobante de pago.", Number(caso.commercial_flow_version) >= 2 ? null : caso.estado || null, null, "public"]);
      return true;
    });
    if (!saved) {
      deleteUploadedFile(req.file);
      return res.status(403).json({ error: "No se pudo autorizar la accion" });
    }
    return res.status(201).json({
      message: "Comprobante cargado correctamente.",
      payment_receipt_id: receiptId,
      payment_receipt_uploaded_at: new Date().toISOString()
    });
  } catch (err) {
    deleteUploadedFile(req.file);
    console.error("PUBLIC PAYMENT RECEIPT ERR:", req.requestId, err.message);
    return res.status(500).json({ error: "No se pudo cargar el comprobante" });
  }
});

app.get("/api/enterprise", authRequired, adminOnly, async (_req, res) => {
  try {
    const rows = all("SELECT * FROM enterprise_inquiries ORDER BY created_at DESC");
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: "Error al listar consultas" });
  }
});

app.get("/api/enterprise-users", authRequired, adminOnly, async (_req, res) => {
  try {
    const rows = all(
      "SELECT id, email, created_at FROM users WHERE role = 'enterprise' ORDER BY email ASC"
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: "Error al listar usuarios empresa" });
  }
});

app.post("/api/enterprise-users", authRequired, adminOnly, async (req, res) => {
  try {
    const validated = validateBody(enterpriseUserCreateSchema, req.body);
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error });
    }

    const emailNorm = cleanText(validated.data.email, 180)?.toLowerCase();
    if (!emailNorm) {
      return res.status(400).json({ error: "Email invalido" });
    }

    const existing = get("SELECT id FROM users WHERE lower(email) = lower(?)", [emailNorm]);
    if (existing) {
      return res.status(409).json({ error: "Ese email ya existe" });
    }

    const passwordPlain = cleanText(validated.data.password || "", 100) || generateEnterprisePassword();
    if (!isStrongPassword(passwordPlain)) {
      return res.status(400).json({
        error: "La contrasena debe tener entre 8 y 72 caracteres, con letras y numeros"
      });
    }

    const passwordHash = await bcrypt.hash(passwordPlain, 10);
    const userId = randomUUID();

    run(
      "INSERT INTO users (id, email, password_hash, role, email_verified, created_at) VALUES (?, ?, ?, 'enterprise', 1, CURRENT_TIMESTAMP)",
      [userId, emailNorm, passwordHash]
    );

    logSecurityEvent(req, {
      userId: req.user.sub,
      eventType: "enterprise_user_created",
      resourceType: "user",
      resourceId: userId,
      success: true,
      details: { email: emailNorm, role: "enterprise" }
    });

    return res.status(201).json({
      message: "Usuario empresa creado",
      user: { id: userId, email: emailNorm, role: "enterprise" },
      generated_password: passwordPlain
    });
  } catch (err) {
    return res.status(500).json({ error: "Error al crear usuario empresa" });
  }
});

app.get("/api/security/login-audit", authRequired, adminOnly, async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit || 200);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 1000) : 200;
    const email = cleanText(req.query.email, 180);
    if (email) {
      const rows = all(
        `SELECT id, user_id, email, ip, user_agent, success, reason, attempts, lock_until, request_id, created_at
         FROM auth_login_audit
         WHERE lower(email) = lower(?)
         ORDER BY created_at DESC
         LIMIT ?`,
        [email, limit]
      );
      return res.json(rows);
    }
    const rows = all(
      `SELECT id, user_id, email, ip, user_agent, success, reason, attempts, lock_until, request_id, created_at
       FROM auth_login_audit
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: "Error al listar auditoria de login" });
  }
});

app.get("/api/enterprise-retention", authRequired, async (req, res) => {
  try {
    if (req.user?.role !== "enterprise") {
      return res.status(403).json({ error: "Acceso restringido" });
    }
    const settings = getEnterpriseRetentionSettings(req.user.sub);
    return res.json(settings);
  } catch (err) {
    return res.status(500).json({ error: "Error al obtener configuracion de purga" });
  }
});

app.put("/api/enterprise-retention", authRequired, async (req, res) => {
  try {
    if (req.user?.role !== "enterprise") {
      return res.status(403).json({ error: "Acceso restringido" });
    }
    const validated = validateBody(enterpriseRetentionSchema, req.body);
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error });
    }
    const normalized = normalizeEnterpriseRetentionInput(validated.data);
    if (!normalized.ok) {
      return res.status(400).json({ error: normalized.error });
    }

    run(
      `INSERT INTO enterprise_retention_settings
      (enterprise_user_id, retention_mode, retention_days, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(enterprise_user_id) DO UPDATE SET
        retention_mode = excluded.retention_mode,
        retention_days = excluded.retention_days,
        updated_by = excluded.updated_by,
        updated_at = CURRENT_TIMESTAMP`,
      [req.user.sub, normalized.mode, normalized.days, req.user.sub]
    );

    logSecurityEvent(req, {
      userId: req.user.sub,
      eventType: "enterprise_retention_update",
      resourceType: "enterprise_settings",
      resourceId: req.user.sub,
      success: true,
      details: { retention_mode: normalized.mode, retention_days: normalized.days }
    });

    const settings = getEnterpriseRetentionSettings(req.user.sub);
    return res.json(settings);
  } catch (err) {
    return res.status(500).json({ error: "Error al guardar configuracion de purga" });
  }
});

app.get("/api/security/events", authRequired, adminOnly, async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit || 200);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 1000) : 200;
    const eventType = cleanText(req.query.event_type, 80);
    const userId = cleanText(req.query.user_id, 120);

    if (eventType) {
      const rows = all(
        `SELECT id, user_id, event_type, resource_type, resource_id, success, details, ip, user_agent, request_id, created_at
         FROM security_events
         WHERE event_type = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [eventType, limit]
      );
      return res.json(rows);
    }

    if (userId) {
      const rows = all(
        `SELECT id, user_id, event_type, resource_type, resource_id, success, details, ip, user_agent, request_id, created_at
         FROM security_events
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [userId, limit]
      );
      return res.json(rows);
    }

    const rows = all(
      `SELECT id, user_id, event_type, resource_type, resource_id, success, details, ip, user_agent, request_id, created_at
       FROM security_events
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: "Error al listar eventos de seguridad" });
  }
});

// -------------------- AUTH --------------------
app.post("/api/auth/register", authLimiter, async (req, res) => {
  try {
    const validated = validateBody(registerSchema, req.body);
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error });
    }
    const { email, password, account_type } = validated.data;
    const requestedAccountType = String(account_type || "user").trim().toLowerCase();
    if (requestedAccountType === "enterprise") {
      return res.status(403).json({
        error: "El alta de cuentas empresa se realiza solo por administracion de RFA"
      });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({
        error: "La contrasena debe tener entre 8 y 72 caracteres, con letras y numeros"
      });
    }

    const emailNorm = cleanText(email, 180)?.toLowerCase();
    if (!emailNorm) {
      return res.status(400).json({ error: "Email invalido" });
    }
    if (ADMIN_EMAILS.includes(emailNorm)) {
      return res.status(403).json({ error: "Esta cuenta solo puede administrarse desde el servidor" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const role = "user";
    const userId = randomUUID();
    run(
      "INSERT INTO users (id, email, password_hash, role, email_verified, created_at) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)",
      [userId, emailNorm, passwordHash, role]
    );
    logSecurityEvent(req, {
      userId,
      eventType: "auth_register",
      resourceType: "user",
      resourceId: userId,
      success: true,
      details: { email: emailNorm, role }
    });
    return res.status(201).json({ message: "Registro creado correctamente." });
  } catch (err) {
    if (String(err.message || "").includes("UNIQUE")) {
      return res.status(409).json({ error: "El email ya esta registrado" });
    }
    console.error("REGISTER ERR:", req.requestId, err.message);
    return res.status(500).json({ error: "Error al registrar" });
  }
});

app.post("/api/auth/login", loginLimiter, async (req, res) => {
  try {
    const validated = validateBody(loginSchema, req.body);
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error });
    }
    const { email, password } = validated.data;
    const emailNorm = cleanText(email, 180)?.toLowerCase();
    if (!emailNorm) {
      return res.status(400).json({ error: "Email invalido" });
    }

    const attemptKey = getLoginAttemptKey(req, emailNorm);
    const attemptState = getLoginAttemptState(attemptKey);
    if (attemptState?.lockUntil) {
      const waitSeconds = Math.ceil((attemptState.lockUntil - Date.now()) / 1000);
      logLoginAudit(req, {
        email: emailNorm,
        success: false,
        reason: "locked",
        attempts: attemptState.attempts || null,
        lockUntil: attemptState.lockUntil
      });
      return res.status(429).json({
        error: "Cuenta temporalmente bloqueada por intentos fallidos",
        retryAfterSeconds: Math.max(waitSeconds, 1)
      });
    }

    let user = get("SELECT id, email, password_hash, role FROM users WHERE email = ?", [emailNorm]);
    if (!user) {
      const fail = registerLoginFailure(attemptKey);
      logLoginAudit(req, {
        email: emailNorm,
        success: false,
        reason: "user_not_found",
        attempts: fail.attempts,
        lockUntil: fail.lockUntil
      });
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      const fail = registerLoginFailure(attemptKey);
      logLoginAudit(req, {
        userId: user.id,
        email: emailNorm,
        success: false,
        reason: "invalid_password",
        attempts: fail.attempts,
        lockUntil: fail.lockUntil
      });
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    if (user.role === "user") {
      logLoginAudit(req, {
        userId: user.id,
        email: emailNorm,
        success: false,
        reason: "user_portal_disabled"
      });
      return res.status(403).json({
        error: "El acceso para particulares se realiza desde 'Consultar caso' con email + ID de caso",
        code: "USER_PORTAL_DISABLED"
      });
    }

    clearLoginFailures(attemptKey);
    logLoginAudit(req, {
      userId: user.id,
      email: emailNorm,
      success: true,
      reason: "ok",
      attempts: 0
    });

    const token = signToken(user);
    const refreshSession = createRefreshTokenSession(req, user.id);
    res.cookie(REFRESH_TOKEN_COOKIE, refreshSession.token, getRefreshCookieOptions());
    setCsrfCookie(res);
    logSecurityEvent(req, {
      userId: user.id,
      eventType: "auth_login",
      resourceType: "user",
      resourceId: user.id,
      success: true
    });
    return res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error("LOGIN ERR:", req.requestId, err.message);
    return res.status(500).json({ error: "Error al iniciar sesion" });
  }
});

app.post("/api/auth/refresh", refreshLimiter, async (req, res) => {
  try {
    if (!requireCsrfToken(req, res)) {
      logSecurityEvent(req, {
        userId: null,
        eventType: "auth_refresh",
        resourceType: "session",
        success: false,
        details: { reason: "csrf_invalid" }
      });
      return;
    }
    const refreshToken = String(req.cookies?.[REFRESH_TOKEN_COOKIE] || "").trim();
    if (!refreshToken) {
      logSecurityEvent(req, {
        userId: null,
        eventType: "auth_refresh",
        resourceType: "session",
        success: false,
        details: { reason: "refresh_cookie_missing" }
      });
      return res.status(401).json({ error: "Sesion expirada. Inicia sesion nuevamente." });
    }

    const tokenHash = hashRefreshToken(refreshToken);
    const session = get(
      `SELECT id, user_id, token_hash, expires_at, revoked_at
       FROM refresh_tokens
       WHERE token_hash = ?`,
      [tokenHash]
    );

    if (!session || session.revoked_at) {
      clearRefreshCookie(res);
      clearCsrfCookie(res);
      logSecurityEvent(req, {
        userId: session?.user_id || null,
        eventType: "auth_refresh",
        resourceType: "session",
        success: false,
        details: { reason: "refresh_session_invalid" }
      });
      return res.status(401).json({ error: "Sesion expirada. Inicia sesion nuevamente." });
    }

    const expiresAtMs = Date.parse(session.expires_at);
    if (Number.isNaN(expiresAtMs) || expiresAtMs <= Date.now()) {
      revokeRefreshTokenByHash(tokenHash);
      clearRefreshCookie(res);
      clearCsrfCookie(res);
      logSecurityEvent(req, {
        userId: session.user_id,
        eventType: "auth_refresh",
        resourceType: "session",
        success: false,
        details: { reason: "refresh_expired" }
      });
      return res.status(401).json({ error: "Sesion expirada. Inicia sesion nuevamente." });
    }

    let user = get("SELECT id, email, role FROM users WHERE id = ?", [session.user_id]);
    if (!user) {
      revokeRefreshTokenByHash(tokenHash);
      clearRefreshCookie(res);
      clearCsrfCookie(res);
      logSecurityEvent(req, {
        userId: session.user_id,
        eventType: "auth_refresh",
        resourceType: "session",
        success: false,
        details: { reason: "user_not_found" }
      });
      return res.status(401).json({ error: "Sesion invalida" });
    }

    const rotatedSession = createRefreshTokenSession(req, user.id);
    revokeRefreshTokenByHash(tokenHash, rotatedSession.sessionId);
    res.cookie(REFRESH_TOKEN_COOKIE, rotatedSession.token, getRefreshCookieOptions());
    setCsrfCookie(res);

    const token = signToken(user);
    logSecurityEvent(req, {
      userId: user.id,
      eventType: "auth_refresh",
      resourceType: "session",
      success: true
    });
    return res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error("REFRESH ERR:", req.requestId, err.message);
    clearRefreshCookie(res);
    clearCsrfCookie(res);
    return res.status(500).json({ error: "No se pudo renovar la sesion" });
  }
});

app.post("/api/auth/logout", async (req, res) => {
  try {
    if (!requireCsrfToken(req, res)) {
      logSecurityEvent(req, {
        userId: req.user?.sub || null,
        eventType: "auth_logout",
        resourceType: "session",
        success: false,
        details: { reason: "csrf_invalid" }
      });
      return;
    }
    const refreshToken = String(req.cookies?.[REFRESH_TOKEN_COOKIE] || "").trim();
    let userId = null;
    if (refreshToken) {
      const tokenHash = hashRefreshToken(refreshToken);
      const session = get("SELECT user_id FROM refresh_tokens WHERE token_hash = ?", [tokenHash]);
      userId = session?.user_id || null;
      revokeRefreshTokenByHash(tokenHash);
    }
    clearRefreshCookie(res);
    clearCsrfCookie(res);
    logSecurityEvent(req, {
      userId,
      eventType: "auth_logout",
      resourceType: "session",
      success: true
    });
    return res.json({ message: "Sesion cerrada" });
  } catch (err) {
    console.error("LOGOUT ERR:", req.requestId, err.message);
    clearRefreshCookie(res);
    clearCsrfCookie(res);
    return res.status(500).json({ error: "No se pudo cerrar sesion" });
  }
});

app.get("/api/me", authRequired, async (req, res) => {
  try {
    const user = get("SELECT id, email, role, created_at FROM users WHERE id = ?", [req.user.sub]);
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ error: "Error al obtener usuario" });
  }
});
// -------------------- CASOS --------------------
app.get("/api/cases", authRequired, async (req, res) => {
  try {
    if (req.user.role === "admin") {
      const rows = all(`
        SELECT c.*, u.email AS user_email, eu.email AS enterprise_email,
               COALESCE(cc.pending_admin_attention, 0) AS conversation_pending_admin_attention,
               EXISTS(SELECT 1 FROM case_payment_receipts pr WHERE pr.case_id = c.id AND pr.status = 'pending') AS payment_receipt_pending,
               (SELECT COUNT(*) FROM case_service_offers so WHERE so.case_id = c.id AND so.status = 'published') AS published_offer_count,
               (SELECT cu.estado FROM case_updates cu WHERE cu.case_id = c.id AND cu.visibility = 'public' AND cu.estado IS NOT NULL ORDER BY cu.created_at DESC, cu.rowid DESC LIMIT 1) AS latest_public_operational_status
        FROM cases c
        JOIN users u ON u.id = c.user_id
        LEFT JOIN users eu ON eu.id = c.enterprise_user_id
        LEFT JOIN case_conversations cc ON cc.case_id = c.id
        ORDER BY c.created_at DESC
      `);
      return res.json(rows.map(addPersonaV2OperationalStage));
    }
    if (req.user.role === "enterprise") {
      const rows = all(
        `SELECT c.*, u.email AS user_email
         FROM cases c
         JOIN users u ON u.id = c.user_id
         WHERE c.enterprise_user_id = ?
         ORDER BY c.created_at DESC`,
        [req.user.sub]
      );
      return res.json(rows.map((row) => sanitizeCaseForRole(row, "enterprise")));
    }
    const rows = all(`
      SELECT c.*,
             (SELECT cu.estado FROM case_updates cu WHERE cu.case_id = c.id AND cu.visibility = 'public' AND cu.estado IS NOT NULL ORDER BY cu.created_at DESC, cu.rowid DESC LIMIT 1) AS latest_public_operational_status
      FROM cases c WHERE c.user_id = ? ORDER BY c.created_at DESC
    `, [req.user.sub]);
    return res.json(rows.map((row) => addPersonaV2OperationalStageForRole(sanitizeCaseForRole(row, "user"), "user")));
  } catch (err) {
    return res.status(500).json({ error: "Error al listar casos" });
  }
});

app.post("/api/cases", authRequired, authenticatedUploadLimiter, maybeUpload, async (req, res) => {
  const uploadedFiles = req.files || [];
  let caseCreated = false;
  try {
    if (req.user.role === "enterprise") {
      uploadedFiles.forEach(deleteUploadedFile);
      return res.status(403).json({ error: "Los casos empresa se incorporan mediante la importacion autorizada" });
    }
    const validated = validateBody(publicCaseCreateSchema, req.body);
    if (!validated.ok) {
      uploadedFiles.forEach(deleteUploadedFile);
      return res.status(400).json({ error: validated.error });
    }

    const body = validated.data;
    const {
      categoria,
      nombre_completo,
      dni_cuit,
      email_contacto,
      telefono,
      entidad,
      tipo_entidad,
      monto_valor,
      monto_escala,
      monto_moneda,
      medios_pago,
      relato,
      autorizacion,
      acepta_terminos,
      acepta_privacidad,
      detalle
    } = body;

    const detalleValue = cleanText(relato || detalle, 4000);
    if (!detalleValue) {
      uploadedFiles.forEach(deleteUploadedFile);
      return res.status(400).json({ error: "La descripcion del caso es obligatoria" });
    }

    const nombreCompletoClean = cleanText(nombre_completo, 120);
    const dniCuitClean = cleanText(dni_cuit, 40);
    const emailContactoClean = cleanText(email_contacto === "" ? null : email_contacto, 180)?.toLowerCase();
    const telefonoClean = cleanText(telefono, 60);
    const entidadClean = cleanText(entidad, 160);
    const tipoEntidadClean = cleanText(tipo_entidad, 160);
    const montoValorClean = cleanText(monto_valor, 40);
    const montoEscalaClean = cleanText(monto_escala, 40);
    const montoMonedaClean = cleanText(monto_moneda, 20);
    const relatoClean = cleanText(relato, 4000);
    const serviceCodeForNewCase = INITIAL_ANALYSIS_SERVICE_CODE;
    const caseCode = generatePublicCaseCode();
    const files = uploadedFiles.map((file) => ({
      originalName: file.originalname,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype
    }));

    const caseId = randomUUID();
    const estadoInicial = "received";
    const prioridadInicial = "Pendiente";
    const riesgoInicial = "Pendiente";
    run(
      `INSERT INTO cases (
        id, user_id, categoria, detalle, estado, nombre_completo, dni_cuit, email_contacto, telefono,
        entidad, tipo_entidad, monto_valor, monto_escala, monto_moneda, medios_pago, relato,
        autorizacion, terms_accepted, privacy_accepted, consent_version, consent_accepted_at,
        adjuntos, plan_elegido, service_code, commercial_status, quoted_currency, case_code, prioridad, riesgo,
        commercial_flow_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        caseId,
        req.user.sub,
        cleanText(categoria, 120),
        detalleValue,
        estadoInicial,
        nombreCompletoClean,
        dniCuitClean,
        emailContactoClean,
        telefonoClean,
        entidadClean,
        tipoEntidadClean,
        montoValorClean,
        montoEscalaClean,
        montoMonedaClean,
        typeof medios_pago === "string" ? medios_pago : JSON.stringify(medios_pago || []),
        relatoClean,
        autorizacion === "true" || autorizacion === true ? 1 : 0,
        isAccepted(acepta_terminos) ? 1 : 0,
        isAccepted(acepta_privacidad) ? 1 : 0,
        POLICY_CONSENT_VERSION,
        new Date().toISOString(),
        files.length ? JSON.stringify(files) : null,
        serviceCodeForNewCase,
        serviceCodeForNewCase,
        "analysis",
        "ARS",
        caseCode,
        prioridadInicial,
        riesgoInicial,
        2
      ]
    );
    caseCreated = true;

    const initialUpdateId = randomUUID();
    run("INSERT INTO case_updates (id, case_id, author_id, mensaje, estado, prioridad, visibility) VALUES (?, ?, ?, ?, ?, ?, ?)", [
      initialUpdateId,
      caseId,
      req.user.sub,
      "Caso cargado por el usuario.",
      estadoInicial,
      null,
      "public"
    ]);
    logSecurityEvent(req, {
      userId: req.user.sub,
      eventType: "case_create",
      resourceType: "case",
      resourceId: caseId,
      success: true,
      details: {
        estado: estadoInicial,
        categoria: cleanText(categoria, 120)
      }
    });

    const created = get("SELECT * FROM cases WHERE id = ?", [caseId]);
    return res.status(201).json(created);
  } catch (err) {
    if (!caseCreated) uploadedFiles.forEach(deleteUploadedFile);
    console.error("CREATE CASE ERR:", err.message);
    if (err.stack) console.error(err.stack);
    return res.status(500).json({ error: "Error al crear el caso" });
  }
});
app.get("/api/cases/:id", authRequired, async (req, res) => {
  try {
    const caso = req.user.role === "admin"
      ? get(
        `SELECT c.*, COALESCE(cc.pending_admin_attention, 0) AS conversation_pending_admin_attention,
                (SELECT cu.estado FROM case_updates cu WHERE cu.case_id = c.id AND cu.visibility = 'public' AND cu.estado IS NOT NULL ORDER BY cu.created_at DESC, cu.rowid DESC LIMIT 1) AS latest_public_operational_status
         FROM cases c LEFT JOIN case_conversations cc ON cc.case_id = c.id WHERE c.id = ?`,
        [req.params.id]
      )
      : get("SELECT * FROM cases WHERE id = ?", [req.params.id]);
    if (!caso) return res.status(404).json({ error: "Caso no encontrado" });

    if (!canAccessCase(req.user, caso)) {
      return res.status(403).json({ error: "Acceso restringido" });
    }
    const sanitized = addPersonaV2OperationalStageForRole(sanitizeCaseForRole(caso, req.user.role), req.user.role);
    if (req.user.role === "admin" && !caso.enterprise_user_id) {
      sanitized.service_offers = getCaseServiceOffers(caso.id);
      sanitized.payment_receipts = getCasePaymentReceipts(caso.id);
      sanitized.payment_receipt_pending = sanitized.payment_receipts.some((receipt) => receipt.status === "pending");
    }
    return res.json(sanitized);
  } catch (err) {
    return res.status(500).json({ error: "Error al obtener caso" });
  }
});

app.get("/api/cases/:id/updates", authRequired, async (req, res) => {
  try {
    const caso = get("SELECT * FROM cases WHERE id = ?", [req.params.id]);
    if (!caso) return res.status(404).json({ error: "Caso no encontrado" });
    if (!canAccessCase(req.user, caso)) {
      return res.status(403).json({ error: "Acceso restringido" });
    }

    const visibilityClause = req.user.role === "admin"
      ? ""
      : req.user.role === "enterprise"
        ? "AND COALESCE(cu.visibility, 'public') <> 'rfa_internal'"
        : "AND COALESCE(cu.visibility, 'public') = 'public'";
    const authorSelect = req.user.role === "admin"
      ? ", u.email AS author_email"
      : "";
    const rows = all(
      `SELECT cu.*${authorSelect}
       FROM case_updates cu
       LEFT JOIN users u ON u.id = cu.author_id
       WHERE cu.case_id = ? ${visibilityClause}
       ORDER BY cu.created_at DESC, cu.rowid DESC`,
      [req.params.id]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: "Error al listar actualizaciones" });
  }
});

app.get("/api/cases/:id/files/:filename", authRequired, async (req, res) => {
  try {
    const caso = get("SELECT * FROM cases WHERE id = ?", [req.params.id]);
    if (!caso) return res.status(404).json({ error: "Caso no encontrado" });
    if (!canAccessCase(req.user, caso)) {
      return res.status(403).json({ error: "Acceso restringido" });
    }

    const requestedFilename = path.basename(String(req.params.filename || ""));
    if (!requestedFilename) {
      return res.status(400).json({ error: "Archivo invalido" });
    }

    let attachments = [];
    try {
      attachments = JSON.parse(caso.adjuntos || "[]");
      if (!Array.isArray(attachments)) attachments = [];
    } catch {
      attachments = [];
    }

    const attachment = attachments.find((item) => item?.filename === requestedFilename);
    if (!attachment) {
      return res.status(404).json({ error: "Adjunto no encontrado" });
    }

    const filePath = path.join(UPLOADS_DIR, requestedFilename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Archivo no disponible" });
    }

    const downloadName = attachment.originalName || requestedFilename;
    return res.download(filePath, downloadName);
  } catch (err) {
    return res.status(500).json({ error: "Error al descargar adjunto" });
  }
});

app.get("/api/cases/:id/payment-receipts", authRequired, adminOnly, (req, res) => {
  const caso = get("SELECT id, enterprise_user_id FROM cases WHERE id = ?", [req.params.id]);
  if (!caso || caso.enterprise_user_id) return res.status(404).json({ error: "Caso no encontrado" });
  return res.json(getCasePaymentReceipts(caso.id));
});

app.get("/api/cases/:id/payment-receipts/:receiptId", authRequired, adminOnly, (req, res) => {
  const caso = get("SELECT id, case_code, enterprise_user_id FROM cases WHERE id = ?", [req.params.id]);
  if (!caso || caso.enterprise_user_id) return res.status(404).json({ error: "Comprobante no encontrado" });
  const receipt = get("SELECT * FROM case_payment_receipts WHERE id = ? AND case_id = ?", [req.params.receiptId, caso.id]);
  if (!receipt) return res.status(404).json({ error: "Comprobante no encontrado" });
  const filename = path.basename(String(receipt.storage_filename || ""));
  const filePath = path.join(UPLOADS_DIR, filename);
  if (!filename || !fs.existsSync(filePath)) return res.status(404).json({ error: "Comprobante no disponible" });
  return res.download(filePath, cleanText(receipt.original_filename, 255) || `comprobante_${caso.case_code || caso.id}`);
});

app.post("/api/cases/:id/payment-confirm", authRequired, adminOnly, adminActionTokenLimiter, (req, res) => {
  try {
    const caso = get("SELECT * FROM cases WHERE id = ?", [req.params.id]);
    if (!caso || caso.enterprise_user_id) return res.status(404).json({ error: "Caso no encontrado" });
    if (getEffectiveCommercialStatus(caso) !== "payment_pending") {
      return res.status(409).json({ error: "El caso no está pendiente de pago" });
    }
    const receipt = req.body?.receipt_id
      ? get("SELECT id FROM case_payment_receipts WHERE id = ? AND case_id = ? AND status = 'pending'", [String(req.body.receipt_id), caso.id])
      : get("SELECT id FROM case_payment_receipts WHERE case_id = ? AND status = 'pending' ORDER BY uploaded_at DESC, rowid DESC LIMIT 1", [caso.id]);
    if (!receipt) return res.status(409).json({ error: "No hay un comprobante pendiente de verificación" });
    const verifiedAt = new Date().toISOString();
    const confirmed = runInTransaction(() => {
      if (!runAndCount("UPDATE case_payment_receipts SET status = 'verified', verified_at = ?, verified_by = ? WHERE id = ? AND case_id = ? AND status = 'pending'", [verifiedAt, req.user.sub, receipt.id, caso.id])) return false;
      if (!runAndCount("UPDATE cases SET commercial_status = 'paid', payment_confirmed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND commercial_status = 'payment_pending'", [verifiedAt, caso.id])) {
        throw new Error("PAYMENT_CONFIRM_CONFLICT");
      }
      run("INSERT INTO case_updates (id, case_id, author_id, mensaje, estado, prioridad, visibility) VALUES (?, ?, ?, ?, ?, ?, ?)", [randomUUID(), caso.id, req.user.sub, "RFA confirmó el pago.", null, null, "public"]);
      return true;
    });
    if (!confirmed) return res.status(409).json({ error: "No se pudo confirmar el pago" });
    logSecurityEvent(req, { eventType: "case_payment_confirmed", resourceType: "case", resourceId: caso.id, success: true });
    const updatedCase = get("SELECT * FROM cases WHERE id = ?", [caso.id]);
    return res.json({ case: addPersonaV2OperationalStage({ ...updatedCase, payment_receipt_pending: false }), payment_receipts: getCasePaymentReceipts(caso.id) });
  } catch (err) {
    if (err.message === "PAYMENT_CONFIRM_CONFLICT") return res.status(409).json({ error: "No se pudo confirmar el pago" });
    console.error("CASE PAYMENT CONFIRM ERR:", req.requestId, err.message);
    return res.status(500).json({ error: "No se pudo confirmar el pago" });
  }
});

app.get("/api/cases/:id/payment-receipt", authRequired, async (req, res) => {
  try {
    const caso = get("SELECT * FROM cases WHERE id = ?", [req.params.id]);
    if (!caso) return res.status(404).json({ error: "Caso no encontrado" });
    if (!canAccessCase(req.user, caso)) {
      return res.status(403).json({ error: "Acceso restringido" });
    }

    const filename = path.basename(String(caso.payment_receipt_filename || "").trim());
    if (!filename) {
      return res.status(404).json({ error: "El caso no tiene comprobante cargado" });
    }
    const filePath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Comprobante no disponible" });
    }
    const downloadName = cleanText(caso.payment_receipt_original_name, 255) || `comprobante_${caso.case_code || caso.id}`;
    return res.download(filePath, downloadName);
  } catch (err) {
    return res.status(500).json({ error: "Error al descargar comprobante" });
  }
});

app.post("/api/cases/:id/updates", authRequired, async (req, res) => {
  try {
    const validated = validateBody(caseUpdateSchema, req.body);
    if (!validated.ok) return res.status(400).json({ error: validated.error });

    const caso = get("SELECT * FROM cases WHERE id = ?", [req.params.id]);
    if (!caso) return res.status(404).json({ error: "Caso no encontrado" });
    if (!canAccessCase(req.user, caso)) return res.status(403).json({ error: "Acceso restringido" });

    const isAdmin = req.user.role === "admin";
    const isEnterprise = req.user.role === "enterprise";
    const isEnterpriseCase = Boolean(caso.enterprise_user_id);
    if (!isAdmin && !isEnterprise) return res.status(403).json({ error: "Acceso restringido" });

    const data = validated.data;
    const {
      mensaje,
      estado,
      plan_elegido,
      service_code,
      quoted_amount,
      quoted_currency,
      quoted_scope,
      commercial_status,
      communication_mode,
      message_visibility,
      prioridad,
      riesgo,
      documentacion_estado,
      observaciones_empresa,
      observaciones_rfa,
      descripcion_breve
    } = data;

    const proposalFields = ["service_code", "quoted_amount", "quoted_currency", "quoted_scope", "commercial_status"];
    const hasProposalInput = proposalFields.some((field) => Object.prototype.hasOwnProperty.call(data, field));
    const hasCommunicationModeInput = Object.prototype.hasOwnProperty.call(data, "communication_mode");
    if (!isEnterpriseCase && Number(caso.commercial_flow_version) >= 2 && (hasProposalInput || hasCommunicationModeInput)) {
      return res.status(400).json({ error: "Las opciones y transiciones comerciales se gestionan mediante el flujo de ofertas y acciones confirmadas" });
    }
    if (Object.prototype.hasOwnProperty.call(data, "plan_elegido") && plan_elegido != null) {
      return res.status(400).json({ error: "plan_elegido es un campo historico; usa service_code" });
    }
    if ((hasProposalInput || hasCommunicationModeInput) && (!isAdmin || isEnterpriseCase)) {
      return res.status(403).json({ error: "La propuesta comercial solo se administra en casos particulares" });
    }
    if (hasCommunicationModeInput) {
      if (!isValidCommunicationMode(communication_mode)) {
        return res.status(400).json({ error: "Modalidad de comunicaciones invalida" });
      }
      if (caso.proposal_accepted_at && communication_mode !== (caso.communication_mode || null)) {
        return res.status(409).json({ error: "La modalidad no puede cambiarse despues de aceptar la propuesta" });
      }
    }
    if (isEnterprise && (riesgo != null || documentacion_estado != null || observaciones_rfa != null)) {
      return res.status(403).json({ error: "La evaluacion RFA solo puede ser modificada por administracion" });
    }

    const allowedEnterpriseStatuses = new Set([
      "pendiente",
      "en analisis",
      "respondido",
      "pendiente de revision",
      "en analisis interno",
      "falta documentacion",
      "a la espera de respuesta de la entidad",
      "observacion interna",
      "resuelto",
      "cerrado",
      "recibido",
      "pendiente interno"
    ]);
    const allowedPriority = new Set(["pendiente", "normal", "alta", "critica", "media", "baja"]);
    const allowedRisk = new Set(["pendiente", "bajo", "medio", "alto", "critico"]);
    const allowedDocumentation = new Set(["completa", "incompleta", "en revision", "parcial", "sin documentacion"]);

    const normalizedStatus = normalizeCompareText(estado);
    const normalizedPriority = normalizeCompareText(prioridad);
    const normalizedRisk = normalizeCompareText(riesgo);
    const normalizedDocumentation = normalizeCompareText(documentacion_estado);

    if (estado) {
      if (isEnterpriseCase && !allowedEnterpriseStatuses.has(normalizedStatus)) {
        return res.status(400).json({ error: "Estado invalido para un caso empresa" });
      }
      if (!isEnterpriseCase && !PARTICULAR_OPERATIONAL_STATUSES.has(String(estado))) {
        return res.status(400).json({ error: "Estado operativo invalido" });
      }
    }
    if (prioridad && !allowedPriority.has(normalizedPriority)) {
      return res.status(400).json({ error: "Prioridad invalida" });
    }
    if (riesgo && !allowedRisk.has(normalizedRisk)) {
      return res.status(400).json({ error: "Riesgo invalido" });
    }
    if (documentacion_estado && !allowedDocumentation.has(normalizedDocumentation)) {
      return res.status(400).json({ error: "Estado de documentacion invalido" });
    }

    const amountResult = normalizeQuotedAmount(quoted_amount);
    if (amountResult.error) return res.status(400).json({ error: amountResult.error });
    const nextServiceCode = service_code !== undefined
      ? cleanText(service_code, 80)
      : cleanText(caso.service_code, 80) || INITIAL_ANALYSIS_SERVICE_CODE;
    const nextAmount = amountResult.provided ? amountResult.value : caso.quoted_amount ?? null;
    const nextCurrency = quoted_currency !== undefined
      ? String(quoted_currency || "ARS").trim().toUpperCase()
      : caso.quoted_currency || "ARS";
    const nextScope = quoted_scope !== undefined
      ? cleanText(quoted_scope, 4000)
      : caso.quoted_scope || null;
    const nextCommercialStatus = commercial_status !== undefined
      ? cleanText(commercial_status, 40)
      : caso.commercial_status || "analysis";
    const nextCommunicationMode = hasCommunicationModeInput
      ? communication_mode
      : caso.communication_mode || null;
    const proposalAlreadyAccepted = Boolean(caso.proposal_accepted_at) ||
      ["accepted", "payment_pending", "paid"].includes(getEffectiveCommercialStatus(caso));
    if (proposalAlreadyAccepted) {
      const termsChanged =
        (service_code !== undefined && nextServiceCode !== (cleanText(caso.service_code, 80) || null)) ||
        (amountResult.provided && nextAmount !== (Number(caso.quoted_amount) || null)) ||
        (quoted_currency !== undefined && nextCurrency !== String(caso.quoted_currency || "ARS").toUpperCase()) ||
        (quoted_scope !== undefined && nextScope !== (cleanText(caso.quoted_scope, 4000) || null)) ||
        (hasCommunicationModeInput && nextCommunicationMode !== (caso.communication_mode || null));
      if (termsChanged) {
        return res.status(409).json({ error: "Los terminos de una propuesta aceptada no pueden modificarse" });
      }
    }

    if (hasProposalInput) {
      if (!PARTICULAR_SERVICE_CODES.has(String(nextServiceCode || ""))) {
        return res.status(400).json({ error: "Servicio RFA invalido" });
      }
      if (nextCurrency !== "ARS") {
        return res.status(400).json({ error: "La moneda de la propuesta debe ser ARS" });
      }
      if (!COMMERCIAL_STATUSES.has(String(nextCommercialStatus || ""))) {
        return res.status(400).json({ error: "Situacion comercial invalida" });
      }
      if (nextCommercialStatus !== "analysis") {
        if (!PAID_SERVICE_CODES.has(String(nextServiceCode || ""))) {
          return res.status(400).json({ error: "Selecciona un servicio pago para enviar la propuesta" });
        }
        if (!Number.isSafeInteger(Number(nextAmount)) || Number(nextAmount) < 1) {
          return res.status(400).json({ error: "Indica un precio valido para la propuesta" });
        }
        if (!nextScope) {
          return res.status(400).json({ error: "Indica el alcance de la propuesta" });
        }
      }
    }

    const normalizePriorityValue = (value, fallback) => {
      if (!value) return fallback || null;
      if (normalizedPriority === "pendiente") return "Pendiente";
      if (normalizedPriority === "baja") return "Baja";
      if (normalizedPriority === "media" || normalizedPriority === "normal") return "Media";
      if (normalizedPriority === "critica") return "Crítica";
      if (normalizedPriority === "alta") return "Alta";
      return value;
    };
    const normalizeRiskValue = (value, fallback) => {
      if (!value) return fallback || null;
      if (normalizedRisk === "pendiente") return "Pendiente";
      if (normalizedRisk === "critico") return "Crítico";
      if (normalizedRisk === "alto") return "Alto";
      if (normalizedRisk === "medio") return "Medio";
      if (normalizedRisk === "bajo") return "Bajo";
      return value;
    };
    const normalizeDocumentationValue = (value, fallback) => {
      if (!value) return fallback || null;
      if (normalizedDocumentation === "en revision") return "En revisión";
      if (normalizedDocumentation === "sin documentacion") return "Sin documentación";
      if (normalizedDocumentation === "parcial") return "Parcial";
      if (normalizedDocumentation === "completa") return "Completa";
      if (normalizedDocumentation === "incompleta") return "Incompleta";
      return value;
    };

    const newEstado = estado || caso.estado;
    const newPrioridad = normalizePriorityValue(prioridad, caso.prioridad);
    const newRiesgo = normalizeRiskValue(riesgo, caso.riesgo);
    const newDocumentacion = normalizeDocumentationValue(documentacion_estado, caso.documentacion_estado);
    const newObsEmpresa = observaciones_empresa !== undefined
      ? cleanText(observaciones_empresa, 3000)
      : caso.observaciones_empresa || null;
    const newObsRfa = isAdmin && observaciones_rfa !== undefined
      ? cleanText(observaciones_rfa, 3000)
      : caso.observaciones_rfa || null;
    const newDescripcion = descripcion_breve !== undefined
      ? cleanText(descripcion_breve, 4000)
      : cleanText(caso.detalle, 4000);

    const isPersonaV2Case = !isEnterpriseCase && Number(caso.commercial_flow_version) >= 2;
    const requestedMessage = isNonEmptyString(mensaje) ? cleanText(mensaje, 3000) : "";
    const requestedVisibility = isEnterprise
      ? "enterprise_internal"
      : message_visibility === "public" && requestedMessage
        ? "public"
        : "rfa_internal";
    const caseFieldsChanged =
      newEstado !== (caso.estado || null) ||
      newPrioridad !== (caso.prioridad || null) ||
      newRiesgo !== (caso.riesgo || null) ||
      newDocumentacion !== (caso.documentacion_estado || null) ||
      newObsEmpresa !== (caso.observaciones_empresa || null) ||
      newObsRfa !== (caso.observaciones_rfa || null) ||
      (descripcion_breve !== undefined && newDescripcion !== (cleanText(caso.detalle, 4000) || null));
    const latestVisibleUpdate = requestedMessage
      ? get(
          `SELECT mensaje, visibility FROM case_updates
           WHERE case_id = ? AND COALESCE(visibility, 'public') = ?
           ORDER BY created_at DESC, rowid DESC LIMIT 1`,
          [caso.id, requestedVisibility]
        )
      : null;
    const duplicateMessage = Boolean(requestedMessage && latestVisibleUpdate?.mensaje === requestedMessage);
    if (isPersonaV2Case && !caseFieldsChanged && (!requestedMessage || duplicateMessage)) {
      return res.json({ update: null, case: addPersonaV2OperationalStage(caso) });
    }

    const now = new Date().toISOString();
    const nextQuotedAt = nextCommercialStatus !== "analysis" && !caso.quoted_at ? now : caso.quoted_at || null;
    const nextAcceptedAt = ["accepted", "payment_pending", "paid"].includes(nextCommercialStatus) && !caso.proposal_accepted_at
      ? now
      : caso.proposal_accepted_at || null;
    const nextPaymentConfirmedAt = nextCommercialStatus === "paid" && !caso.payment_confirmed_at
      ? now
      : caso.payment_confirmed_at || null;
    const nextAcceptedProposalSnapshot = !isEnterpriseCase &&
      !caso.accepted_proposal_snapshot &&
      !caso.proposal_accepted_at &&
      ["accepted", "payment_pending", "paid"].includes(nextCommercialStatus)
      ? serializeAcceptedProposalSnapshot({
          service_code: nextServiceCode,
          quoted_amount: nextAmount,
          quoted_currency: nextCurrency,
          quoted_scope: nextScope,
          communication_mode: nextCommunicationMode
        })
      : caso.accepted_proposal_snapshot || null;

    const messageText = requestedMessage
      ? requestedMessage
      : isEnterprise
        ? "Actualizacion interna de empresa."
        : isPersonaV2Case
          ? "Se actualizó información interna del expediente."
          : "Actualizacion interna RFA.";
    const visibility = isEnterprise
      ? "enterprise_internal"
      : message_visibility === "public" && requestedMessage
        ? "public"
        : "rfa_internal";

    const updateId = randomUUID();
    run(
      "INSERT INTO case_updates (id, case_id, author_id, mensaje, estado, prioridad, visibility) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [updateId, req.params.id, req.user.sub, messageText, estado || null, prioridad || null, visibility]
    );
    run(
      `UPDATE cases
       SET estado = ?, prioridad = ?, riesgo = ?, documentacion_estado = ?,
           observaciones_empresa = ?, observaciones_rfa = ?, detalle = ?, relato = ?,
           service_code = ?, quoted_amount = ?, quoted_currency = ?, quoted_scope = ?, commercial_status = ?,
           communication_mode = ?, accepted_proposal_snapshot = ?, quoted_at = ?, proposal_accepted_at = ?, payment_confirmed_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        newEstado,
        newPrioridad,
        newRiesgo,
        newDocumentacion,
        newObsEmpresa,
        newObsRfa,
        newDescripcion,
        newDescripcion,
        isEnterpriseCase ? caso.service_code || null : nextServiceCode,
        isEnterpriseCase ? caso.quoted_amount || null : nextAmount,
        isEnterpriseCase ? caso.quoted_currency || null : nextCurrency,
        isEnterpriseCase ? caso.quoted_scope || null : nextScope,
        isEnterpriseCase ? caso.commercial_status || null : nextCommercialStatus,
        isEnterpriseCase ? caso.communication_mode || null : nextCommunicationMode,
        isEnterpriseCase ? caso.accepted_proposal_snapshot || null : nextAcceptedProposalSnapshot,
        isEnterpriseCase ? caso.quoted_at || null : nextQuotedAt,
        isEnterpriseCase ? caso.proposal_accepted_at || null : nextAcceptedAt,
        isEnterpriseCase ? caso.payment_confirmed_at || null : nextPaymentConfirmedAt,
        req.params.id
      ]
    );

    logSecurityEvent(req, {
      userId: req.user.sub,
      eventType: "case_update",
      resourceType: "case",
      resourceId: req.params.id,
      success: true,
      details: {
        fromEstado: caso.estado || null,
        toEstado: newEstado || null,
        fromCommercialStatus: caso.commercial_status || null,
        toCommercialStatus: isEnterpriseCase ? null : nextCommercialStatus,
        actorRole: req.user.role,
        visibility
      }
    });

    return res.status(201).json({
      update: get("SELECT * FROM case_updates WHERE id = ?", [updateId]),
      case: addPersonaV2OperationalStage(get("SELECT * FROM cases WHERE id = ?", [req.params.id]))
    });
  } catch (err) {
    console.error("CASE UPDATE ERR:", req.requestId, err.message);
    return res.status(500).json({ error: "Error al actualizar el caso" });
  }
});

app.post("/api/cases/import", authRequired, adminOnly, importLimiter, importUpload.any(), async (req, res) => {
  let importedCount = 0;
  let rejectedCount = 0;
  let importedFailed = false;
  let targetEnterpriseUserId = "";
  try {
    const requestedEnterpriseUserId = String(req.body?.enterprise_user_id || "").trim();
    const enterpriseUserId = requestedEnterpriseUserId;
    if (!enterpriseUserId) {
      return res.status(400).json({ error: "Debes seleccionar un usuario empresa" });
    }
    const enterpriseUser = get("SELECT id, email, role FROM users WHERE id = ?", [enterpriseUserId]);
    if (!enterpriseUser || enterpriseUser.role !== "enterprise") {
      return res.status(400).json({ error: "Usuario empresa invalido" });
    }
    targetEnterpriseUserId = enterpriseUser.id;
    const files = (Array.isArray(req.files) ? req.files : []).filter((f) =>
      f?.fieldname === "files" || f?.fieldname === "file"
    );
    if (!files.length) {
      return res.status(400).json({ error: "Debes adjuntar al menos un archivo (CSV/Excel)" });
    }
    const uploadError = validateUploadedFiles(files, { totalLimit: IMPORT_MAX_TOTAL_BYTES, importFile: true });
    if (uploadError) return res.status(400).json({ error: uploadError });
    const rows = [];
    for (const file of files) {
      const fileRows = await parseImportFileRows(file);
      if (rows.length + fileRows.length > IMPORT_MAX_ROWS) throw new Error("IMPORT_ROW_LIMIT");
      fileRows.forEach((row) => rows.push({ ...row, __source_file: file.originalname || file.filename }));
    }
    if (!rows.length) {
      return res.status(400).json({ error: "Archivos vacios o sin filas validas" });
    }

    const allowedDocumentation = ["Sin documentación", "Parcial", "Completa", "Incompleta", "En revisión"];
    const normalizeImportDate = (value) => {
      const raw = String(value || "").trim();
      if (!raw) return new Date().toISOString().slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
      const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      if (slash) {
        const day = String(slash[1]).padStart(2, "0");
        const month = String(slash[2]).padStart(2, "0");
        const year = slash[3].length === 2 ? `20${slash[3]}` : slash[3];
        return `${year}-${month}-${day}`;
      }
      const dash = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
      if (dash) {
        const day = String(dash[1]).padStart(2, "0");
        const month = String(dash[2]).padStart(2, "0");
        const year = dash[3].length === 2 ? `20${dash[3]}` : dash[3];
        return `${year}-${month}-${day}`;
      }
      const parsed = Date.parse(raw);
      if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
      return new Date().toISOString().slice(0, 10);
    };
    const normalizeDocumento = (value) => String(value || "").replace(/[^\dA-Za-z]/g, "").trim();
    const normalizeImportStatus = (value) => {
      const v = normalizeHeader(value).replace(/_/g, " ");
      if (!v) return "Pendiente";
      if (v === "pendiente de revision" || v === "recibido" || v === "pendiente" || v === "abierto") {
        return "Pendiente";
      }
      if (v === "en analisis" || v === "en analisis interno") return "En análisis";
      if (v === "respondido" || v === "resuelto" || v === "respuesta recibida") return "Respondido";
      if (v === "cerrado") return "Cerrado";
      return "";
    };
    const normalizeImportPriority = (value) => {
      const v = normalizeHeader(value).replace(/_/g, " ");
      if (!v) return "Media";
      if (v === "baja") return "Baja";
      if (v === "media" || v === "normal") return "Media";
      if (v === "alta" || v === "urgente") return "Alta";
      if (v === "critica" || v === "critico") return "Crítica";
      return "";
    };
    const normalizeImportRisk = (value) => {
      const v = normalizeHeader(value).replace(/_/g, " ");
      if (!v) return "Medio";
      if (v === "bajo") return "Bajo";
      if (v === "medio") return "Medio";
      if (v === "alto") return "Alto";
      if (v === "critico" || v === "critica") return "Crítico";
      return "";
    };
    const normalizeImportDocumentation = (value) => {
      const v = normalizeHeader(value).replace(/_/g, " ");
      if (!v) return "Sin documentación";
      if (v === "sin documentacion") return "Sin documentación";
      if (v === "completa") return "Completa";
      if (v === "parcial" || v === "parcialmente completa" || v === "incompleta") return "Parcial";
      if (v === "en revision" || v === "revision") return "Parcial";
      return "";
    };
    const importedRows = [];
    const rejectedRows = [];
    const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
    const humanizeLocalPart = (value) => {
      const local = String(value || "").split("@")[0] || "";
      const cleaned = local.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
      if (!cleaned) return "Cliente sin nombre";
      return cleaned
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    };

    rows.forEach((row, idx) => {
      const line = idx + 2;
      const sourceFile = String(row.__source_file || "").trim();
      const consumedKeys = new Set();
      const take = (aliases = []) => {
        for (const key of aliases) {
          const normalized = normalizeHeader(key);
          const value = String(row?.[normalized] ?? "").trim();
          if (value) {
            consumedKeys.add(normalized);
            return value;
          }
        }
        return "";
      };
      const takeByPattern = (regex) => {
        const entries = Object.entries(row || {});
        for (const [key, rawValue] of entries) {
          if (key === "__source_file" || consumedKeys.has(key)) continue;
          const value = String(rawValue || "").trim();
          if (!value) continue;
          if (regex.test(key)) {
            consumedKeys.add(key);
            return value;
          }
        }
        return "";
      };
      const takeEmail = () => {
        const explicit = take([
          "email_contacto",
          "email",
          "correo",
          "correo_electronico",
          "mail",
          "e_mail",
          "email_cliente",
          "email_address"
        ]);
        if (explicit) return explicit;
        const entries = Object.entries(row || {});
        for (const [key, rawValue] of entries) {
          if (key === "__source_file" || consumedKeys.has(key)) continue;
          const value = String(rawValue || "").trim();
          if (!value) continue;
          if (isValidEmail(value)) {
            consumedKeys.add(key);
            return value;
          }
        }
        return "";
      };

      const caseCodeRaw = take([
        "case_code",
        "codigo",
        "codigo_rfa",
        "id_caso",
        "nro_caso",
        "numero_caso",
        "ticket",
        "numero_ticket"
      ]);
      const caseCode = caseCodeRaw || generatePublicCaseCode();
      const empresa = take(["empresa", "company", "razon_social", "empresa_origen"]);
      const fechaCaso = normalizeImportDate(
        take(["fecha_caso", "fecha", "fecha_reclamo", "created_at", "fecha_ingreso", "fecha_alta", "fecha_de_alta"])
      );
      const nombre = take(["nombre", "first_name", "nombres"]);
      const apellido = take(["apellido", "last_name", "apellidos"]);
      const combinedName = [nombre, apellido].filter(Boolean).join(" ").trim();
      const clienteNombre =
        take([
          "cliente_nombre",
          "nombre_cliente",
          "cliente",
          "nombre_completo",
          "apellido_y_nombre",
          "titular",
          "titular_nombre",
          "full_name"
        ]) || combinedName;
      let clienteDocumento = normalizeDocumento(
        take([
          "cliente_documento",
          "dni",
          "documento",
          "documento_numero",
          "numero_documento",
          "nro_documento",
          "n_documento",
          "dni_cuit",
          "cuit",
          "cuil",
          "identificacion",
          "id_cliente"
        ])
      );
      if (!clienteDocumento) {
        const fromIdField = normalizeDocumento(take(["id"]));
        if (fromIdField && /\d{6,14}/.test(fromIdField)) {
          clienteDocumento = fromIdField;
        }
      }
      if (!clienteDocumento) {
        const guessedDoc = normalizeDocumento(takeByPattern(/(dni|documento|cuit|cuil|id)/));
        if (guessedDoc && /\d{6,14}/.test(guessedDoc)) {
          clienteDocumento = guessedDoc;
        }
      }
      const emailContacto = takeEmail();
      const entidad = take(["entidad", "banco", "proveedor", "empresa_reclamada", "plataforma", "grupo_saliente"]);
      const tipoReclamo =
        take(["tipo_reclamo", "tipo", "categoria", "motivo", "asunto", "clasificacion", "clasificación"]) ||
        take(["plan", "servicio", "tipo_plan"]);
      const descripcion =
        take(["descripcion", "detalle", "descripcion_del_reclamo", "reclamo", "observaciones", "mensaje", "resumen"]) ||
        "Caso importado por empresa. Pendiente de ampliación.";
      const monto = take(["monto", "importe", "monto_valor", "capital", "saldo"]);
      const moneda = take(["moneda", "currency"]).toUpperCase();
      const canalOrigen = take(["canal_origen", "canal", "origen"]);
      const estado = "Pendiente";
      const prioridad = "Pendiente";
      const riesgo = "Pendiente";
      const documentacionEstado = normalizeImportDocumentation(
        take(["documentacion", "documentacion_estado", "estado_documentacion", "documentacion_status"])
      );
      const observaciones = take([
        "observaciones_internas",
        "observaciones",
        "nota",
        "notas",
        "comentarios",
        "observacion"
      ]);

      const remainingDetails = Object.entries(row || {})
        .filter(([key, rawValue]) => {
          if (key === "__source_file") return false;
          if (consumedKeys.has(key)) return false;
          return String(rawValue || "").trim().length > 0;
        })
        .slice(0, 15)
        .map(([key, rawValue]) => `${key}: ${String(rawValue || "").trim()}`);
      const mergedObservaciones = [observaciones, remainingDetails.join(" | ")].filter(Boolean).join(" | ");

      const nombreFinal = clienteNombre || humanizeLocalPart(emailContacto) || `Cliente ${line - 1}`;
      if (emailContacto && !isValidEmail(emailContacto)) {
        rejectedRows.push({ line, file: sourceFile || null, reason: "Email invalido" });
        return;
      }

      if (!documentacionEstado || !allowedDocumentation.includes(documentacionEstado)) {
        rejectedRows.push({ line, file: sourceFile || null, reason: "Documentacion invalida" });
        return;
      }
      if (caseCode) {
        const duplicate = get("SELECT id FROM cases WHERE case_code = ? AND enterprise_user_id = ?", [
          caseCode,
          targetEnterpriseUserId
        ]);
        if (duplicate) {
          rejectedRows.push({ line, file: sourceFile || null, reason: "Codigo de caso duplicado para esa empresa" });
          return;
        }
      }

      const caseId = randomUUID();
      run(
        `INSERT INTO cases (
          id, user_id, categoria, detalle, estado, nombre_completo, dni_cuit, email_contacto, entidad,
          monto_valor, monto_moneda, relato, autorizacion, case_code, empresa, prioridad,
          fecha_caso, canal_origen, enterprise_user_id, riesgo, documentacion_estado, observaciones_empresa
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          caseId,
          req.user.sub,
          tipoReclamo || "Sin plan asignado",
          descripcion,
          estado,
          nombreFinal || null,
          clienteDocumento || null,
          emailContacto ? emailContacto.toLowerCase() : null,
          entidad || "Entidad no informada",
          monto || null,
          moneda || null,
          descripcion,
          0,
          caseCode || null,
          empresa || enterpriseUser.email,
          prioridad,
          fechaCaso,
          canalOrigen || null,
          targetEnterpriseUserId,
          riesgo,
          documentacionEstado,
          mergedObservaciones || null
        ]
      );

      run("INSERT INTO case_updates (id, case_id, author_id, mensaje, estado, prioridad, visibility) VALUES (?, ?, ?, ?, ?, ?, ?)", [
        randomUUID(),
        caseId,
        req.user.sub,
        mergedObservaciones || "Caso importado masivamente por RFA.",
        estado,
        prioridad,
        "enterprise_internal"
      ]);
      importedRows.push({ line, file: sourceFile || null, case_code: caseCode });
    });

    importedCount = importedRows.length;
    rejectedCount = rejectedRows.length;

    return res.status(201).json({
      total: rows.length,
      imported: importedRows.length,
      rejected: rejectedRows.length,
      rejectedRows
    });
  } catch (err) {
    importedFailed = true;
    if (["IMPORT_ROW_LIMIT", "IMPORT_COLUMN_LIMIT", "IMPORT_PARSE_TIMEOUT", "IMPORT_WORKER_FAILED", "IMPORT_FILE_INVALID"].includes(err.message)) {
      return res.status(400).json({ error: err.message === "IMPORT_ROW_LIMIT"
        ? `La importacion supera el maximo de ${IMPORT_MAX_ROWS} filas.`
        : err.message === "IMPORT_COLUMN_LIMIT"
          ? `La importacion supera el maximo de ${IMPORT_MAX_COLUMNS} columnas.`
          : "No se pudo procesar uno de los archivos. Verifica que sea un CSV o XLSX valido y vuelve a intentar." });
    }
    console.error("IMPORT CASES ERR:", req.requestId, err.message);
    return res.status(500).json({ error: "Error al importar casos masivos" });
  } finally {
    try {
      logSecurityEvent(req, {
        userId: req.user?.sub || null,
        eventType: "case_import",
        resourceType: "enterprise",
        resourceId: targetEnterpriseUserId,
        success: !importedFailed && (importedCount > 0 || rejectedCount > 0),
        details: {
          imported: importedCount,
          rejected: rejectedCount
        }
      });
    } catch (_e) {
      // noop
    }
    (Array.isArray(req.files) ? req.files : []).forEach((file) => {
      if (file?.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    });
  }
});

// Alias antiguos por compatibilidad
app.get("/api/casos", (req, res) => res.redirect(307, "/api/cases"));
app.post("/api/casos", (req, res) => res.redirect(307, "/api/cases"));

app.use((err, req, res, next) => {
  if (!err) return next();
  (req.files || []).forEach(deleteUploadedFile);
  deleteUploadedFile(req.file);
  const isConversationMessage = /^\/api\/(?:public\/case-conversations\/messages|cases\/[^/]+\/conversations\/messages)$/.test(req.path);
  if (isConversationMessage && err.code === "UNSUPPORTED_FILE_TYPE") {
    const name = cleanText(path.basename(String(err.fileName || "archivo")), 120) || "archivo";
    return res.status(400).json({ error: `El archivo "${name}" tiene un formato no permitido. Usá PDF, PNG, JPG/JPEG, DOC, DOCX o TXT.` });
  }
  if (isConversationMessage && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "Un archivo supera el límite de 25 MB." });
  }
  if (isConversationMessage && ["LIMIT_FILE_COUNT", "LIMIT_UNEXPECTED_FILE"].includes(err.code)) {
    return res.status(400).json({ error: `Podés adjuntar hasta ${CASE_ATTACHMENT_MAX_FILES} archivos.` });
  }
  if (req.path === "/api/public/cases") {
    if (err.code === "UNSUPPORTED_FILE_TYPE") {
      return res.status(400).json({
        error: `El archivo "${err.fileName || "seleccionado"}" tiene un formato no permitido. Usá PDF, PNG, JPG/JPEG, DOC, DOCX o TXT.`
      });
    }
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "Un archivo supera el límite de 25 MB. Revisá el tamaño de cada adjunto." });
    }
    if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({ error: `Podés adjuntar hasta ${CASE_ATTACHMENT_MAX_FILES} archivos.` });
    }
  }
  if (err.code === "UNSUPPORTED_FILE_TYPE") {
    return res.status(400).json({ error: "Error de carga de archivos" });
  }
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      if (req.path === "/api/cases/import") return res.status(413).json({ error: "Un archivo de importacion supera 10 MB." });
      if (req.path === "/api/public/case-payment-receipt") return res.status(413).json({ error: "El comprobante supera el limite de 25 MB." });
      return res.status(413).json({ error: "Un adjunto supera el limite permitido." });
    }
    return res.status(400).json({ error: "Error de carga de archivos" });
  }
  if (String(err.message || "").includes("CORS")) {
    return res.status(403).json({ error: "Origen no permitido" });
  }
  return res.status(500).json({ error: "Error interno del servidor" });
});

function openVerifiedDatabase(SQL, filePath) {
  if (fs.statSync(filePath).size === 0) throw new Error("SQLite file is empty");
  const candidate = new SQL.Database(new Uint8Array(fs.readFileSync(filePath)));
  try {
    const result = candidate.exec("PRAGMA integrity_check");
    if (result[0]?.values?.length !== 1 || result[0].values[0][0] !== "ok") {
      throw new Error("SQLite integrity check failed");
    }
    return candidate;
  } catch (error) {
    candidate.close();
    throw error;
  }
}

function recoverDatabase(SQL) {
  const bakPath = `${DB_PATH}.bak`;
  if (fs.existsSync(DB_PATH)) {
    try {
      return openVerifiedDatabase(SQL, DB_PATH);
    } catch (primaryError) {
      if (!fs.existsSync(bakPath)) throw primaryError;
      console.warn("DB RECOVERY: primary database invalid; checking backup");
    }
  } else if (!fs.existsSync(bakPath)) {
    return new SQL.Database();
  }

  const backup = openVerifiedDatabase(SQL, bakPath);
  backup.close();
  const restorePath = `${DB_PATH}.restore-${randomUUID()}`;
  const corruptPath = `${DB_PATH}.corrupt-${randomUUID()}`;
  const hadPrimary = fs.existsSync(DB_PATH);
  try {
    fs.copyFileSync(bakPath, restorePath, fs.constants.COPYFILE_EXCL);
    openVerifiedDatabase(SQL, restorePath).close();
    if (hadPrimary) fs.renameSync(DB_PATH, corruptPath);
    try {
      fs.renameSync(restorePath, DB_PATH);
    } catch (error) {
      if (hadPrimary && !fs.existsSync(DB_PATH)) fs.renameSync(corruptPath, DB_PATH);
      throw error;
    }
    console.warn("DB RECOVERY: restored verified backup; original backup preserved");
    return openVerifiedDatabase(SQL, DB_PATH);
  } finally {
    if (fs.existsSync(restorePath)) fs.unlinkSync(restorePath);
  }
}

initSqlJs({ locateFile: (file) => path.join(__dirname, "node_modules", "sql.js", "dist", file) })
  .then((SQL) => {
    db = recoverDatabase(SQL);
    initDb();
    ensureAdminAccounts();
    if (DATA_PURGE_ENABLED) {
      try {
        const firstPurge = purgeExpiredClosedCases();
        console.log("PURGE INIT:", JSON.stringify(firstPurge));
      } catch (err) {
        console.error("PURGE INIT ERR:", err.message);
      }
      const purgeIntervalMs = DATA_PURGE_INTERVAL_HOURS * 60 * 60 * 1000;
      setInterval(() => {
        try {
          const result = purgeExpiredClosedCases();
          if (result.deletedUserCases > 0 || result.deletedEnterpriseCases > 0) {
            console.log("PURGE RUN:", JSON.stringify(result));
          }
        } catch (err) {
          console.error("PURGE RUN ERR:", err.message);
        }
      }, purgeIntervalMs);
    }
    server = app.listen(PORT, () => {
      console.log(`Servidor corriendo en el puerto ${PORT}`);
    });

    const shutdown = (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`SHUTDOWN: ${signal}`);
      try {
        if (flushTimer) clearTimeout(flushTimer);
      } catch (_e) {}
      try {
        flushPersistDb();
      } catch (_e) {}
      if (server) {
        server.close(() => {
          process.exit(0);
        });
        // hard-exit if close hangs
        setTimeout(() => process.exit(0), 8000).unref();
      } else {
        process.exit(0);
      }
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  })
  .catch((err) => {
    console.error("DB INIT ERR:", err.message);
    process.exit(1);
  });
